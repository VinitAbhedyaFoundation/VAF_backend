export function getTemplatePath(
  driveTitle: string,
) {
  const title = driveTitle.toLowerCase();

  if (title.includes('blood')) {
    return 'assets/certificate-templates/blood-donation-template.png';
  }

  if (title.includes('cloth')) {
    return 'assets/certificate-templates/cloth-donation-template.png';
  }

  if (title.includes('tree')) {
    return 'assets/certificate-templates/tree-plantation-template.png';
  }

  return 'assets/certificate-templates/cloth-donation-template.png';
}