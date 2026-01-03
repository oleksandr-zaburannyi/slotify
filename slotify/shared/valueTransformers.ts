import {ValueTransformer} from "typeorm";

export const toInt: ValueTransformer = {
    to: value => (value ? parseInt(value, 10) : value),
    from: value => (value ? parseInt(value, 10) : value),
};

export const toFloat: ValueTransformer = {
    to: value => value,
    from: value => (value ? parseFloat(value) : value),
};
