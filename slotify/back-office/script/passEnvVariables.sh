sed -i -e 's|%VITE_BO_API_URL%|'${VITE_BO_API_URL:-""}'|g' ./build/index.html
VITE_NAME_ESCAPED=$(printf '%s' "$VITE_NAME" | sed -e 's/[\/&]/\\&/g')
sed -i -e 's|%VITE_NAME%|'${VITE_NAME_ESCAPED:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_ENV%|'${VITE_ENV:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_LOGO%|'${VITE_LOGO:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_BASE_CURRENCY%|'${VITE_BASE_CURRENCY:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_BASE_CURRENCY_DECIMALS%|'${VITE_BASE_CURRENCY_DECIMALS:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_IS_PRODUCTION%|'${VITE_IS_PRODUCTION:-""}'|g' ./build/index.html
sed -i -e 's|%VITE_HIDE_FOOTER%|'${VITE_HIDE_FOOTER:-""}'|g' ./build/index.html
