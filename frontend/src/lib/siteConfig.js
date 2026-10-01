import { useEffect, useState } from 'react';
import api from './api';
const defaults = { shippingCost: 300, freeShippingThreshold: 100000, storeName: 'BuildForge', checkoutEnabled: false, paymentMethods: [], analyticsId: '', supportEmail: '', storeAddress: '', shippingPolicy: '', returnPolicy: '' };
let configPromise;
export function useSiteConfig() {
  const [config, setConfig] = useState(defaults);
  useEffect(() => {
    let active = true;
    configPromise ||= api.get('/site-config').then(({ data }) => data).catch(() => { configPromise = null; return defaults; });
    configPromise.then((data) => { if (active) setConfig(data); });
    return () => { active = false; };
  }, []);
  return config;
}
