export function getServiceUrl(service: string) {
    const serviceName = service.toUpperCase().replace(/-/g, "_");

    const hostEnvVariableName = serviceName + "_SERVICE_HOST";
    const portEnvVariableName = serviceName + "_SERVICE_PORT";

    return `http://${process.env[hostEnvVariableName]}:${process.env[portEnvVariableName]}`;
}

export function isServiceAvailable(service: string) {
    return !!process.env[`${service.toUpperCase()}_SERVICE_HOST`];
}
