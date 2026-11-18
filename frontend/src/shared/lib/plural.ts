const rules = new Intl.PluralRules("ru");

export function plural(count: number, forms: [string, string, string]) {
  const form = rules.select(count);
  return forms[form === "one" ? 0 : form === "few" ? 1 : 2];
}
