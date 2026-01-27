/**
 * Shared helper functions for person-related formatting
 * Used across both main process (ItemViewClass) and renderer process (Vue components)
 * 
 * IMPORTANT: This is the single source of truth for person name formatting.
 * Keep the original logic - order matters!
 */

/**
 * Format last names according to type, PRESERVING ARRAY ORDER
 * Original logic from ItemViewClass.lastName()
 * 
 * If there's only one last name, return it as-is
 * If there are multiple, preserve order:
 *   - married names (type="married"): shown normally
 *   - maiden/unmarried names (no type or other): shown in parentheses
 * 
 * Example: [{last: "Moss"}, {last: "Russell", type: "married"}] → "(Moss) Russell"
 * Example: "Mary Elizabeth (Moss) Russell"
 * 
 * @param {Array} lastObj - Array of last name objects with { last: string, type?: string }
 * @returns {string} Formatted last name(s)
 */
export function formatLastName(lastObj) {
  if (!lastObj || !Array.isArray(lastObj) || lastObj.length === 0) {
    return '';
  }
  
  const parts = [];
  
  // If only one last name, return it as-is
  if (lastObj.length === 1) {
    return lastObj[0].last || '';
  }
  
  // Multiple last names - format by type, PRESERVE ORDER
  lastObj.forEach(lastName => {
    if (!lastName.last) return;
    
    if (lastName.type === 'married') {
      // Married names shown normally
      parts.push(lastName.last);
    } else {
      // Maiden/unmarried names (no type) go in parentheses
      parts.push(`(${lastName.last})`);
    }
  });
  
  return parts.join(' ');
}

/**
 * Format a person's full name with optional position
 * 
 * @param {Object} person - Person object with first, last, position, etc.
 * @param {boolean} includePosition - Whether to include position before first name
 * @returns {string} Formatted person name
 */
export function formatPersonName(person, includePosition = false) {
  if (!person) return '';
  
  let first = person.first || '';
  const last = formatLastName(person.last);
  
  // Include position if requested and available
  if (includePosition && person.position) {
    first = `${person.position} ${first}`;
  }
  
  // Build the person name string
  if (first && last) {
    return `${first} ${last}`;
  } else if (last) {
    return last;
  } else if (first) {
    return first;
  }
  
  return '';
}

/**
 * Expand persons array so each person appears once per last name
 * This matches the behavior of the main window navigation column
 * 
 * @param {Array} persons - Array of person objects
 * @returns {Array} - Expanded array where each person appears once per last name
 */
export function expandPersonsByLastName(persons) {
  if (!persons || !Array.isArray(persons)) {
    return [];
  }

  const expanded = [];

  persons.forEach(person => {
    // If person has no last names, add once with empty lastName
    if (!person.last || !Array.isArray(person.last) || person.last.length === 0) {
      expanded.push({
        ...person,
        _sortLastName: '',
        _sortFirstName: person.first || ''
      });
      return;
    }

    // Get married and maiden names for secondary sorting
    const marriedNames = person.last
      .filter(ln => ln.type === 'married')
      .map(ln => ln.last)
      .sort()
      .join(' ');

    const maidenNames = person.last
      .filter(ln => !ln.type || ln.type !== 'married')
      .map(ln => ln.last)
      .sort()
      .join(' ');

    // Create one entry per last name
    person.last.forEach(lastName => {
      const secondaryNames = lastName.type === 'married' ? maidenNames : marriedNames;
      
      expanded.push({
        ...person,
        _sortLastName: lastName.last || '',
        _sortFirstName: person.first || '',
        _sortSecondaryNames: secondaryNames
      });
    });
  });

  // Sort by last name, then first name, then secondary names
  expanded.sort((a, b) => {
    const lastComparison = a._sortLastName.localeCompare(b._sortLastName);
    if (lastComparison !== 0) {
      return lastComparison;
    }

    const firstComparison = a._sortFirstName.localeCompare(b._sortFirstName);
    if (firstComparison !== 0) {
      return firstComparison;
    }

    const secondaryComparison = (a._sortSecondaryNames || '').localeCompare(b._sortSecondaryNames || '');
    return secondaryComparison;
  });

  return expanded;
}
