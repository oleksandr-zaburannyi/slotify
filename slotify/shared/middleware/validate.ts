import Exception from "../Exception";
import {StatusCode} from "../StatusCode";
import {ValidationChain, ValidationError, validationResult} from "express-validator";
import {RequestHandler} from "express";

export function validate(validations: ValidationChain[]): RequestHandler {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        const error = errors.array()[0];
        return next(
            new Exception(getErrorMessage(error), {
                status: StatusCode.UNPROCESSABLE_ENTITY,
                data: {...error},
            }),
        );
    };
}

function formatFieldValidationError(error: {path: string; location: string; value?: string}) {
    return `Incorrect value '${error.path}'`;
}

function getErrorMessage(error: ValidationError) {
    switch (error.type) {
        case "field":
            return formatFieldValidationError(error);
        case "alternative":
            return formatFieldValidationError(error.nestedErrors[0]);
        case "alternative_grouped":
            return formatFieldValidationError(error.nestedErrors[0][0]);
        case "unknown_fields":
            return formatFieldValidationError(error.fields[0]);
        default:
            throw new Error("Unknown validation error");
    }
}
