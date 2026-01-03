const callbacks: {resolve: (value: unknown) => any; reject: () => any}[] = [];

const executeNext = async (func: () => Promise<any>) => {
    if (executing) return;
    if (callbacks.length === 0) return;

    executing = true;

    try {
        await func();
    } catch {
        executing = false;
        callbacks.shift()!.reject();
        return;
    }
    callbacks.shift()!.resolve(null);

    executing = false;

    executeNext(func);
};

let executing = false;
export default async (func: () => Promise<any>) => {
    return new Promise((resolve, reject) => {
        callbacks.push({resolve, reject});
        executeNext(func);
    });
};
