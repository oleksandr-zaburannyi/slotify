import {FocusEvent} from "react";

export const preventFocus = (event: FocusEvent<any, any>) => {
    event.preventDefault();
    if (event.relatedTarget) {
        // Revert focus back to previous blurring element
        event.relatedTarget.focus();
    } else {
        // No previous focus target, blur instead
        event.currentTarget.blur();
    }
};
