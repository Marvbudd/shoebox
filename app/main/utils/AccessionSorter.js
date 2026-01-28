/**
 * AccessionSorter.js
 * 
 * Extracted sorting logic from AccessionClass.js as part of refactoring initiative.
 * Handles all sorting algorithms for accession items in isolation.
 * 
 * Benefits:
 * - Isolated sorting algorithms
 * - Easier to test each sort independently
 * - Simpler to add new sorting options
 * - Reusable in other contexts
 * 
 * See docs/refactoring-recommendations.md for details
 */

export class AccessionSorter {
  /**
   * Sort items by date (earliest to latest)
   * @param {Array} items - Array of accession items
   * @returns {Array} - Sorted array with date information
   */
  sortByDate(items) {
    // Convert date strings to Date objects for proper sorting
    const sortedItems = items.map(item => {
      const dateSort = this._createDateSort(item.date);

      return {
        type: item.type,
        accession: item.accession,
        link: item.link,
        person: item.person,
        date: item.date,
        dateSort
      };
    }).sort((a, b) => a.dateSort - b.dateSort);

    return sortedItems;
  }

  /**
   * Sort items by person (last name, first name, married/maiden name, date)
   * Creates multiple entries per item if multiple people are tagged
   * @param {Array} items - Array of accession items
   * @param {Object} accessionClass - AccessionClass instance for resolving personID references
   * @returns {Array} - Sorted array with person information
   */
  sortByPerson(items, accessionClass) {
    const sortedItems = items.flatMap(item => {
      return item.person.flatMap(personRef => {
        // Resolve personID to person data
        const person = accessionClass.getPerson(personRef.personID);
        if (!person) return [];

        // Handle persons with no last name (only first name)
        if (!person.last || person.last.length === 0) {
          const dateSort = this._createDateSort(item.date);
          return [{
            person: personRef,
            firstName: person.first || '',
            lastName: '',
            secondaryNames: '',
            date: item.date,
            accession: item.accession,
            link: item.link,
            type: item.type,
            dateSort
          }];
        }

        // Collect all married names and concatenate them
        const marriedNames = person.last
          .filter(ln => ln.type === 'married')
          .map(ln => ln.last)
          .sort()
          .join(' ');

        // Collect all maiden/non-married names
        const maidenNames = person.last
          .filter(ln => !ln.type || ln.type !== 'married')
          .map(ln => ln.last)
          .sort()
          .join(' ');

        // Only create entries for each last name in the list
        return person.last.map(lastName => {
          const dateSort = this._createDateSort(item.date);

          // For sorting: 
          // - If this is a maiden name entry, use married names for secondary sort
          // - If this is a married name entry, use maiden names for secondary sort
          const secondaryNames = lastName.type === 'married' ? maidenNames : marriedNames;

          return {
            person: personRef,
            firstName: person.first || '',
            lastName: lastName.last,
            secondaryNames: secondaryNames,
            date: item.date,
            accession: item.accession,
            link: item.link,
            type: item.type,
            dateSort
          };
        });
      });
    }).sort((a, b) => {
      // Compare by last name, then first name, then secondary names (married or maiden), and then date
      const lastComparison = a.lastName.localeCompare(b.lastName);
      if (lastComparison !== 0) {
        return lastComparison;
      }

      const firstComparison = a.firstName.localeCompare(b.firstName);
      if (firstComparison !== 0) {
        return firstComparison;
      }

      const secondaryComparison = a.secondaryNames.localeCompare(b.secondaryNames);
      if (secondaryComparison !== 0) {
        return secondaryComparison;
      }

      return a.dateSort - b.dateSort;
    });

    return sortedItems;
  }

  /**
   * Sort items by location (state, city, detail, date)
   * Creates multiple entries per item if multiple locations are tagged
   * @param {Array} items - Array of accession items
   * @returns {Array} - Sorted array with location information
   */
  sortByLocation(items) {
    const sortedItems = items.flatMap(item => {
      return item.location.flatMap(location => {
        const dateSort = this._createDateSort(item.date);
        const { state, city, detail } = location;

        return {
          location: { ...location },
          state: state || '',
          city: city || '',
          detail: detail || '',
          date: item.date,
          accession: item.accession,
          link: item.link,
          type: item.type,
          dateSort
        };
      });
    }).sort((a, b) => {
      // Compare by location.state
      const stateComparison = a.state.localeCompare(b.state);
      if (stateComparison !== 0) {
        return stateComparison;
      }

      // Compare by location.city
      const cityComparison = a.city.localeCompare(b.city);
      if (cityComparison !== 0) {
        return cityComparison;
      }

      // Compare by location.detail
      const detailComparison = a.detail.localeCompare(b.detail);
      if (detailComparison !== 0) {
        return detailComparison;
      }

      return a.dateSort - b.dateSort;
    });

    return sortedItems;
  }

  /**
   * Sort items by file name (link)
   * @param {Array} items - Array of accession items
   * @returns {Array} - Sorted array by file name
   */
  sortByFile(items) {
    const sortedItems = [...items].sort((a, b) => {
      // Compare by link
      const fileComparison = (a.link || '').localeCompare(b.link || '');
      return fileComparison;
    });

    return sortedItems;
  }

  /**
   * Sort items by source person (last name, first name, date received)
   * Creates multiple entries per item if multiple sources
   * @param {Array} items - Array of accession items
   * @param {Object} accessionClass - AccessionClass instance for resolving personKey references
   * @returns {Array} - Sorted array with source information
   */
  sortBySource(items, accessionClass) {
    const sortedItems = items.flatMap(item => {
      // Skip items without source array or with empty source array
      if (!item.source || !Array.isArray(item.source) || item.source.length === 0) {
        return [];
      }

      return item.source.flatMap(source => {
        // Resolve personKey to person data
        const person = accessionClass.getPerson(source.personID);
        if (!person || !person.last) return [];

        const lastNames = person.last.filter(lastName => {
          return !lastName.type || lastName.type !== "married";
        });

        return lastNames.map(lastName => {
          // sort by date received from the source
          const dateSort = this._createDateSort(source.received);

          return {
            personID: source.personID,
            firstName: person.first || '',
            lastName: lastName.last,
            received: source.received,
            accession: item.accession,
            link: item.link,
            type: item.type,
            dateSort
          };
        });
      });
    }).sort((a, b) => {
      // Compare by source person last name, first name, and then date received
      const lastNameComparison = a.lastName.localeCompare(b.lastName);
      if (lastNameComparison !== 0) {
        return lastNameComparison;
      }

      const firstComparison = a.firstName.localeCompare(b.firstName);
      if (firstComparison !== 0) {
        return firstComparison;
      }

      return a.dateSort - b.dateSort;
    });

    return sortedItems;
  }

  /**
   * Sort items by accession number
   * Handles both numeric and alpha-numeric accession formats
   * @param {Array} items - Array of accession items
   * @returns {Array} - Sorted array by accession number
   */
  sortByAccession(items) {
    const sortedItems = [...items].sort((a, b) => {
      // Extract the numeric part of the accession, handling cases with no digits safely
      const matchA = a.accession && a.accession.match(/\d+/);
      const numericPartA = matchA ? parseInt(matchA[0]) : NaN;
      const matchB = b.accession && b.accession.match(/\d+/);
      const numericPartB = matchB ? parseInt(matchB[0]) : NaN;

      // Compare the numeric part
      if (numericPartA !== numericPartB) {
        return numericPartA - numericPartB;
      }

      // Compare the alpha characters part
      const alphaPartA = a.accession.replace(/\d+/g, '');
      const alphaPartB = b.accession.replace(/\d+/g, '');

      return alphaPartA.localeCompare(alphaPartB);
    });

    return sortedItems;
  }

  /**
   * @returns {number} - Month number (1-12), or 0 if the abbreviation is not recognized
   * @param {string} monthAbbreviation - Three-letter month abbreviation (e.g., 'Jan')
   * @returns {number} - Month number (1-12)
   */
  getMonthNumber(monthAbbreviation) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthAbbreviation) + 1;
  }

  /**
   * Create a Date object for sorting from date components
   * @param {Object} date - Date object with year, month, day properties
   * @returns {Date} - Date object for sorting
   * @private
   */
  _createDateSort(date) {
    const { year, month, day } = date || {};
    return new Date(
      year || 0,
      (month && month.length === 3) ? this.getMonthNumber(month) - 1 : 0,
      day || 1
    );
  }
}
