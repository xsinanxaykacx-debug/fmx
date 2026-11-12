const SURNAME_PARTICLES = new Set([
  'da', 'das', 'de', 'del', 'della', 'der', 'di', 'dos', 'du',
  'la', 'le', 'van', 'von', 'el', 'al', 'bin', 'ibn',
]);

function getSurnameStart(parts: string[]): number {
  let start = parts.length - 1;

  while (start > 0 && SURNAME_PARTICLES.has(parts[start - 1].toLocaleLowerCase('tr'))) {
    start -= 1;
  }

  return start;
}

/**
 * Uzun adları görüntüleme alanına göre kısaltır; kaynak oyuncu adını değiştirmez.
 * Soyadı ve "van/de/el" gibi soyadı parçacıklarını mümkün olduğunca korur.
 */
export function getShortName(fullName: string, maxLength = 14): string {
  const name = fullName?.trim().replace(/\s+/g, ' ') ?? '';
  if (!name) return '';
  if (name.length <= maxLength) return name;

  const parts = name.split(' ');
  if (parts.length === 1) {
    if (maxLength <= 3) return name.slice(0, maxLength);
    return `${name.slice(0, maxLength - 3)}...`;
  }

  const surnameStart = getSurnameStart(parts);
  const surname = parts.slice(surnameStart).join(' ');
  const firstInitial = `${Array.from(parts[0])[0] ?? ''}.`;
  const candidate = `${firstInitial} ${surname}`;

  if (candidate.length <= maxLength) return candidate;

  const availableSurnameLength = maxLength - firstInitial.length - 1;
  if (availableSurnameLength <= 0) return firstInitial.slice(0, maxLength);
  if (availableSurnameLength <= 3) return `${firstInitial} ${surname.slice(0, availableSurnameLength)}`;

  return `${firstInitial} ${surname.slice(0, availableSurnameLength - 3)}...`;
}

/** Tablo hücreleri için kompakt oyuncu adı. */
export function getTableName(fullName: string): string {
  return getShortName(fullName, 12);
}
