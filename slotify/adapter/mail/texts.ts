import {PasswordReset} from "../db/model/PasswordReset";

export const resetPasswordTitle = "Password reset";

export const resetPasswordText = (key: string): string => `
Hello,<br/>
Someone has requested to reset your password. If it was you then please continue the proces <a href="${process.env.URL}/backoffice/change-password/${key}">here</a>.<br/>
The link will expire in ${PasswordReset.KEY_EXPIRY_HOURS} hours.<br/>
If it was not you please ignore this email.
`;

export const newAccountTitle = "Account created";

export const newAccountText = (key: string): string => `
Hello,<br/>
New Back Office account has been created for you. Please continue the proces <a href="${process.env.URL}/backoffice/change-password/${key}">here</a>.<br/>
The link will expire in ${PasswordReset.KEY_EXPIRY_HOURS} hours.<br/>
`;
