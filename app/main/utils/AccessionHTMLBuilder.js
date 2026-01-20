/**
 * AccessionHTMLBuilder.js
 * 
 * Extracted HTML generation logic from AccessionClass.js as part of refactoring initiative.
 * Handles building HTML table output for the navigation view.
 * 
 * Benefits:
 * - Separates presentation from data logic
 * - Easier to change HTML structure
 * - Could swap for different renderers (React, Vue, etc.)
 * - Simplifies transformToHtml() method
 * 
 * See docs/refactoring-recommendations.md for details
 */

import { ItemViewClass } from './ItemViewClass.js';

export class AccessionHTMLBuilder {
  /**
   * Constructor
   * @param {Object} collections - CollectionsClass instance for getting collection keys
   * @param {Object} accessionClass - AccessionClass instance for resolving personID references
   */
  constructor(collections, accessionClass) {
    this.collections = collections;
    this.accessionClass = accessionClass;
  }

  /**
   * Build complete navigation table HTML for sorted items
   * @param {Array} sortedItems - Array of sorted accession items
   * @param {number} sortBy - Sort type (0-5)
   * @returns {Object} - {tableBody: string, navHeader: string}
   */
  buildNavigationTable(sortedItems, sortBy) {
    let htmlOutput = `
        <table class="maintable">
          <tbody>
      `;

    const navHeader = this.buildTableHeader(sortBy);

    // Build rows based on sort type
    sortedItems.forEach(item => {
      htmlOutput += this.buildTableRow(item, sortBy);
    });

    htmlOutput += '</tbody></table>';
    return { tableBody: htmlOutput, navHeader: navHeader };
  }

  /**
   * Build table header based on sort type
   * @param {number} sortBy - Sort type (0-5)
   * @returns {string} - Header HTML
   */
  buildTableHeader(sortBy) {
    switch (sortBy) {
      case 0: // Date
        return `
            <div id="column1" class="Date">Date</div>
            <div id="column2">People</div>
          `;
      case 1: // Person
        return `
            <div id="column1">Person</div>
            <div id="column2" class="dateRight">Date</div>
          `;
      case 2: // Location
        return `
            <div id="column1">Location</div>
            <div id="column2" class="dateRight">Date</div>
          `;
      case 3: // File
        return `
            <div id="column1">File</div>
            <div id="column2" class="dateRight">Date</div>
          `;
      case 4: // Source
        return `
            <div id="column1">Source</div>
            <div id="column2" class="dateRight">Date</div>
          `;
      case 5: // Accession
        return `
            <div id="column1">Accession</div>
            <div id="column2" class="dateRight">Date</div>
          `;
      default:
        console.error('Invalid sortBy option in buildTableHeader:', sortBy);
        return '';
    }
  }

  /**
   * Build a table row based on sort type
   * @param {Object} item - Sorted item data
   * @param {number} sortBy - Sort type (0-5)
   * @returns {string} - Row HTML
   */
  buildTableRow(item, sortBy) {
    const collectionKeys = this.collections.getCollectionKeys(item.link);
    const rowStart = `<tr class="${item.type}" accession="${item.accession}" link="${item.link}" collections="${collectionKeys}">`;
    const rowEnd = '</tr>';

    switch (sortBy) {
      case 0: // Date
        return rowStart +
          '<td><div class="date">' + ItemViewClass.dateText(item.date) + '</div></td>' +
          '<td><div class="descData">' + ItemViewClass.peopleList(item.person, this.accessionClass, false) + '</div></td>' +
          rowEnd;

      case 1: // Person
        return rowStart +
          '<td><div class="descData">' + ItemViewClass.personText(item.person, false, this.accessionClass, false) + '</div></td>' +
          '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
          rowEnd;

      case 2: // Location
        return rowStart +
          '<td><div class="fileData">' + ItemViewClass.locationText(item.location, false, true) + '</div></td>' +
          '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
          rowEnd;

      case 3: // File
        return rowStart +
          '<td><div class="fileData">' + item.link + '</div></td>' +
          '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
          rowEnd;

      case 4: // Source
        // For source sort, the item structure is different - it has personID, firstName, lastName, received
        let sourcePersonName = '';
        if (item.firstName && item.lastName) {
          sourcePersonName = `${item.firstName} ${item.lastName}`;
        } else if (item.lastName) {
          sourcePersonName = item.lastName;
        } else if (item.firstName) {
          sourcePersonName = item.firstName;
        }
        return rowStart +
          '<td><div class="descData">' + sourcePersonName + '</div></td>' +
          '<td><div class="dateData">' + ItemViewClass.dateText(item.received) + '</div></td>' +
          rowEnd;

      case 5: // Accession
        return rowStart +
          '<td><div class="fileData">' + item.accession + '</div></td>' +
          '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
          rowEnd;

      default:
        console.error('Invalid sortBy option in buildTableRow:', sortBy);
        return '';
    }
  }
}
