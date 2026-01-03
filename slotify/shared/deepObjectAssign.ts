export function deepObjectAssign(target: any, ...sources: any[]): any {
    if (!sources.length) {
        return target;
    }

    const source = sources.shift();

    if (isPlainObject(target) && isPlainObject(source)) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (isPlainObject(source[key])) {
                    if (!target[key] || !isPlainObject(target[key])) {
                        target[key] = {};
                    }
                    deepObjectAssign(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
    }

    return deepObjectAssign(target, ...sources);
}

function isPlainObject(obj: any): boolean {
    return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}
