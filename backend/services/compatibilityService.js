/**
 * Reusable PC-part compatibility engine (spec section 12 + 44).
 *
 * Every pairwise check lives here ONCE and is reused by:
 *   - the /build page ("check on every change")
 *   - the "Works With" section on product detail pages
 *   - order validation before a custom build can be checked out
 *
 * A "components" object looks like:
 *   {
 *     cpu: <Product|null>, 'cpu-cooler': <Product|null>, motherboard: <Product|null>,
 *     ram: <Product|null>, gpu: <Product|null>, storage: <Product|null>,
 *     psu: <Product|null>, case: <Product|null>
 *   }
 *
 * Every check only runs when BOTH relevant components are present — an
 * incomplete build is never treated as invalid, per spec ("do not prevent
 * browsing/building because of compatibility issues").
 */

const BASELINE_OTHER_WATTAGE = 100; // motherboard + RAM + storage + fans, roughly

function issue(level, category, message) {
  return { level, category, message }; // level: 'error' | 'warning'
}

function checkCpuMotherboard(cpu, mobo) {
  if (!cpu || !mobo) return [];
  const cpuSocket = cpu.compatibilityData?.socket;
  const moboSocket = mobo.compatibilityData?.socket;
  if (cpuSocket && moboSocket && cpuSocket !== moboSocket) {
    return [
      issue(
        'error',
        'cpu-motherboard',
        `CPU socket (${cpuSocket}) does not match motherboard socket (${moboSocket}).`
      ),
    ];
  }
  return [];
}

function checkRamMotherboard(ram, mobo) {
  if (!ram || !mobo) return [];
  const issues = [];
  const ramType = ram.compatibilityData?.type;
  const moboRamType = mobo.compatibilityData?.ramType;
  if (ramType && moboRamType && ramType !== moboRamType) {
    issues.push(
      issue('error', 'ram-motherboard', `This motherboard does not support ${ramType} RAM (it uses ${moboRamType}).`)
    );
  }
  const ramCapacity = ram.compatibilityData?.capacity;
  const maxRam = mobo.compatibilityData?.maxRam;
  if (ramCapacity && maxRam && ramCapacity > maxRam) {
    issues.push(
      issue('error', 'ram-motherboard', `Selected RAM (${ramCapacity}GB) exceeds this motherboard's maximum supported RAM (${maxRam}GB).`)
    );
  }
  return issues;
}

function checkMotherboardCase(mobo, pcCase) {
  if (!mobo || !pcCase) return [];
  const moboFormFactor = mobo.compatibilityData?.formFactor;
  const supported = pcCase.compatibilityData?.supportedMotherboardSizes;
  if (moboFormFactor && Array.isArray(supported) && !supported.includes(moboFormFactor)) {
    return [
      issue(
        'error',
        'motherboard-case',
        `The motherboard (${moboFormFactor}) does not fit this case (supports ${supported.join(', ')}).`
      ),
    ];
  }
  return [];
}

function checkGpuCase(gpu, pcCase) {
  if (!gpu || !pcCase) return [];
  const gpuLength = gpu.compatibilityData?.length;
  const maxLength = pcCase.compatibilityData?.gpuMaxLength;
  if (gpuLength && maxLength && gpuLength > maxLength) {
    return [
      issue(
        'error',
        'gpu-case',
        `The GPU (${gpuLength}mm) is too long for this case (max ${maxLength}mm).`
      ),
    ];
  }
  return [];
}

function checkCoolerSocket(cooler, cpu) {
  if (!cooler || !cpu) return [];
  const supportedSockets = cooler.compatibilityData?.supportedSockets;
  const cpuSocket = cpu.compatibilityData?.socket;
  if (cpuSocket && Array.isArray(supportedSockets) && !supportedSockets.includes(cpuSocket)) {
    return [
      issue(
        'error',
        'cooler-cpu',
        `This CPU cooler does not support the ${cpuSocket} socket.`
      ),
    ];
  }
  return [];
}

function checkCoolerCase(cooler, pcCase) {
  if (!cooler || !pcCase) return [];
  const isAir = (cooler.compatibilityData?.height || 0) > 60; // AIO radiator thickness vs air-tower height heuristic
  if (!isAir) return []; // AIO radiators are checked against case radiator support, out of scope for v1
  const coolerHeight = cooler.compatibilityData?.height;
  const maxHeight = pcCase.compatibilityData?.cpuCoolerMaxHeight;
  if (coolerHeight && maxHeight && coolerHeight > maxHeight) {
    return [
      issue(
        'error',
        'cooler-case',
        `This CPU cooler (${coolerHeight}mm) is too tall for this case (max ${maxHeight}mm).`
      ),
    ];
  }
  return [];
}

function checkCoolerTdp(cooler, cpu) {
  if (!cooler || !cpu) return [];
  const tdpRating = cooler.compatibilityData?.tdpRating;
  const cpuTdp = cpu.compatibilityData?.tdp;
  if (tdpRating && cpuTdp && cpuTdp > tdpRating) {
    return [
      issue(
        'warning',
        'cooler-cpu-tdp',
        `This cooler is rated for up to ${tdpRating}W — the selected CPU has a TDP of ${cpuTdp}W and may run hot under sustained load.`
      ),
    ];
  }
  return [];
}

// Estimates total power draw and compares it against the selected PSU.
function checkPowerBudget(components) {
  const { cpu, gpu, psu } = components;
  const cpuTdp = cpu?.compatibilityData?.tdp || 0;
  const gpuTdp = gpu?.compatibilityData?.tdp || 0;
  const estimatedPower = cpuTdp + gpuTdp + BASELINE_OTHER_WATTAGE;

  const gpuRecommended = gpu?.compatibilityData?.recommendedPSU || 0;
  const recommendedWattage = Math.max(Math.ceil((estimatedPower * 1.2) / 50) * 50, gpuRecommended);

  const issues = [];
  if (psu) {
    const psuWattage = psu.compatibilityData?.wattage || 0;
    if (psuWattage < estimatedPower) {
      issues.push(
        issue(
          'error',
          'psu-power',
          `Your current PSU (${psuWattage}W) may not provide enough power for this build. Recommended minimum: ${recommendedWattage}W.`
        )
      );
    } else if (psuWattage < recommendedWattage) {
      issues.push(
        issue(
          'warning',
          'psu-power',
          `Your current PSU (${psuWattage}W) is technically enough, but ${recommendedWattage}W+ is recommended for headroom.`
        )
      );
    }

    const psuFormFactor = psu.compatibilityData?.formFactor;
    const caseFormFactor = components.case?.compatibilityData?.psuFormFactor;
    if (psuFormFactor && caseFormFactor && psuFormFactor !== caseFormFactor) {
      issues.push(
        issue(
          'error',
          'psu-case',
          `This case expects a ${caseFormFactor} PSU, but the selected PSU is ${psuFormFactor}.`
        )
      );
    }
  }

  return { issues, estimatedPower, recommendedWattage };
}

/**
 * Runs every applicable check for the given components and returns a full
 * compatibility report.
 */
function checkBuildCompatibility(components) {
  const c = components || {};
  const cooler = c['cpu-cooler'];

  const powerResult = checkPowerBudget(c);

  const issues = [
    ...checkCpuMotherboard(c.cpu, c.motherboard),
    ...checkRamMotherboard(c.ram, c.motherboard),
    ...checkMotherboardCase(c.motherboard, c.case),
    ...checkGpuCase(c.gpu, c.case),
    ...checkCoolerSocket(cooler, c.cpu),
    ...checkCoolerCase(cooler, c.case),
    ...checkCoolerTdp(cooler, c.cpu),
    ...powerResult.issues,
  ];

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'compatible';

  const selectedCount = Object.values(c).filter(Boolean).length;

  return {
    status, // 'compatible' | 'warning' | 'error'
    issues,
    errors,
    warnings,
    estimatedPowerWatts: powerResult.estimatedPower,
    recommendedPsuWattage: powerResult.recommendedWattage,
    selectedCount,
  };
}

// A build can only be checked out (or saved as "final") once every required
// slot is filled AND there are no hard errors. Warnings don't block checkout.
function isBuildOrderable(components, report) {
  const required = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];
  const hasAllRequired = required.every((key) => Boolean(components[key]));
  return hasAllRequired && report.errors.length === 0;
}

module.exports = {
  checkBuildCompatibility,
  isBuildOrderable,
  // exported individually so the "Works With" endpoint and the
  // recommendation engine (Phase 4) can run single checks
  checkCpuMotherboard,
  checkRamMotherboard,
  checkMotherboardCase,
  checkGpuCase,
  checkCoolerSocket,
  checkCoolerCase,
  checkCoolerTdp,
  checkPowerBudget,
};
