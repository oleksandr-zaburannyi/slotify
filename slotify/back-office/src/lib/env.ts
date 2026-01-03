const env = Object.keys(import.meta.env).filter(key => key.indexOf("VITE") === 0).length > 0 ? import.meta.env : (window as any).env;
export default env;
