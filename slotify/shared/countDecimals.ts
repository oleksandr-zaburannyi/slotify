const countDecimals = (value: number): number => {
    if (Math.floor(value) === value) return 0;

    const valueString = value.toString();

    if (valueString.includes("e")) {
        const [base, exponent] = valueString.split("e").map(Number);
        const decimals = base.toString().split(".")[1]?.length || 0;
        const exponentMagnitude = Math.abs(exponent);

        return decimals + (exponent < 0 ? exponentMagnitude : 0);
    } else {
        return valueString.split(".")[1]?.length || 0;
    }
};

export default countDecimals;
