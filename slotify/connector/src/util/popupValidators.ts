type IValidationFn = (data: {action?: string; data?: any; optionIndex?: number}) => boolean;
type IValidationFunctions = Record<string, IValidationFn>;

export const hasOneOptionSelected: IValidationFn = ({optionIndex}) => {
    return optionIndex !== undefined;
};

export const validationFunctions: IValidationFunctions = {
    "requiresOption": hasOneOptionSelected,
};
