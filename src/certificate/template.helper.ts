const TEMPLATE_PATHS: Record<string, string> = {
  blood: 'assets/certificate-templates/blood-donation-template.png',
  cloth: 'assets/certificate-templates/cloth-donation-template.png',
  tree: 'assets/certificate-templates/tree-plantation-template.png',
};

const DEFAULT_TEMPLATE =
  'assets/certificate-templates/cloth-donation-template.png';

export function getTemplatePath(
  driveTitle: string,
): string {
  const title = driveTitle.toLowerCase();

  for (const [keyword, template] of Object.entries(TEMPLATE_PATHS)) {
    if (title.includes(keyword)) {
      return template;
    }
  }

  return DEFAULT_TEMPLATE;
}