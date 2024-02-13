import { format } from 'path'
import { dateText, lastName, personText, peopleList, locationText } from './detailView.js'
const fs = require('fs')

// AccessionClass is a class that reads an accession JSON file and provides methods to access the data
export class AccessionClass {
  constructor(accessionFilename) {
    this.accessionFilename = accessionFilename
    this.accessionJSON = JSON.parse(fs.readFileSync(this.accessionFilename).toString())
    this.categories = null;
  }
  
  // getCategories returns an array of unique categories the accessionJSON
  getCategories() {
    const oldCategories = [
      { value: "demoSet", text: "Demo Media", title: "Demonstration Data Set" },
      { value: "buddc", text: "Chester Budd", title: "The Budd Family" },
      { value: "buddMarv", text: "Marvin Budd", title: "Everything Marvin Budd" },
      { value: "zntDeHart", text: "Zintz DeHart", title: "The Zintz and DeHart Family Collection" },
      { value: "hicks", text: "Hicks", title: "The Hicks Family" },
      { value: "brkErma", text: "Erma Barker", title: "The Erma Barker Collection" },
      { value: "barkerG", text: "George Barker", title: "The George Barker Collection" }
    ]
    if (!this.categories) {
      this.categories = [];
      // fill the categories array with unique categories from the accessionJSON
      // if the new category is in the oldCategories array use the value and text from oldCategories
      // otherwise add it to the categories array with the value and text the same
      this.accessionJSON.accessions.item.forEach(item => {
        item.categories.forEach(category => {
          if (category !== '' && !this.categories.some(c => c.value === category)) {
            const foundCategory = oldCategories.find(c => c.value === category);
            if (foundCategory) {
              this.categories.push(foundCategory);
            } else {
              this.categories.push({ value: category, text: category, title: category });
            }
          }
        });
      });
    }
    return this.categories
  }

  // getTitle returns accessionJSON title
  getTitle() {
    return this.accessionJSON.accessions.title
  }
  
  /**
   * Transforms the data into HTML format for the left hand pane based on the specified sorting criteria.
   * 
   * @param {number} sortBy - The sorting criteria. 0 for sorting by date, 1 for sorting by person and date, 2 for sorting by location, 3 for sorting by file, 4 for sorting by source.
   * @param {string} selectedCategory - The selected category (for some sortBy values-6 selectCategory is used).
   * @returns {string} The HTML output.
   */
    // prior to Jan2024 a transform method was used to create the HTML from xml/xslt but that was unreliable
transformToHtml(sortBy, selectedCategory) {
    try {
      let htmlOutput = `
        <table class="maintable">
          <tbody>
      `;
      let navHeader = '';
      var sortedItems = '';
      switch (sortBy) {
        case 0:
          // Sort by Date - show date and people list in the navigation table
          navHeader = `
            <div id="column1" class="Date">Date</div>
            <div id="column2">People</div>
          `;
          // Convert date strings to Date objects for proper sorting
          sortedItems = this.accessionJSON.accessions.item.map(item => {
            const { year, month, day } = item.date;

            // Handle missing components by providing default values
            const dateSort = new Date(
              year || 0,
              (month && month.length == 3) ? this.getMonthNumber(month) - 1 : 0,
              day || 1
            );

            return {
              ...item,
              dateSort
            };
          }).sort((a, b) => a.dateSort - b.dateSort);

          // Build the HTML output using map and join
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '<td><div class="descData">' + peopleList(item.person) + '</div></td>' +
              '</tr>';
          });
          break;
        case 1:
          // Sort by Person (last, first) and date - show Name and Date in the navigation table
          navHeader = `
            <div id="column1">Person</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.flatMap(item => {
            return item.person.flatMap(person => {
              const lastNames = person.last.filter(lastName => {
                return !lastName.type || lastName.type !== "married";
              });

              return lastNames.map(lastName => {
                const { year, month, day } = item.date;

                // Handle missing components by providing default values
                const dateSort = new Date(
                  year || 0,
                  (month && month.length == 3) ? this.getMonthNumber(month) - 1 : 0,
                  day || 1
                );

                return {
                  person: { ...person },
                  lastName: lastName.last,
                  date: item.date,
                  accession: item.accession,
                  categories: item.categories,
                  type: item.type,
                  dateSort
                };
              });
            });
          }).sort((a, b) => {
            // Compare by person.last, person.first, and then date
            const lastComparison = a.lastName.localeCompare(b.lastName);
            if (lastComparison !== 0) {
              return lastComparison;
            }

            const firstComparison = (a.person.first || '').localeCompare(b.person.first || '');
            if (firstComparison !== 0) {
              return firstComparison;
            }

            return a.dateSort - b.dateSort;
          });
          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="descData">' + personText(item.person) + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '</tr>';
          });
          break;
        case 2:
          // Sort by Location - show Location and Date in the navigation table
          navHeader = `
            <div id="column1">Location</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.flatMap(item => {
            return item.location.flatMap(location => {
              const { state, city, detail } = location;

              return {
                location: { ...location },
                state: state || '',
                city: city || '',
                detail: detail || '',
                date: item.date,
                accession: item.accession,
                type: item.type,
                categories: item.categories
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

            // Compare by date
            const { year: yearA, month: monthA, day: dayA } = a.date;
            const { year: yearB, month: monthB, day: dayB } = b.date;

            // Handle missing components by providing default values
            const dateA = new Date(
              yearA || 0,
              (monthA && monthA.length == 3) ? this.getMonthNumber(monthA) - 1 : 0,
              dayA || 1
            );

            const dateB = new Date(
              yearB || 0,
              (monthB && monthB.length == 3) ? this.getMonthNumber(monthB) - 1 : 0,
              dayB || 1
            );

            return dateA - dateB;
          });

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="fileData">' + locationText(item.location) + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '</tr>';
          });
          break;
        case 3:
          // Sort by File - show Link (File) and Date in the navigation table
          navHeader = `
            <div id="column1">File</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.sort((a, b) => {
            // Compare by file and then date
            const fileComparison = (a.link || '').localeCompare(b.link || '');
            if (fileComparison !== 0) {
              return fileComparison;
            }
            const { year: yearA, month: monthA, day: dayA } = a.date;
            const { year: yearB, month: monthB, day: dayB } = b.date;

            // Handle missing components by providing default values
            const dateA = new Date(
              yearA || 0,
              (monthA && monthA.length == 3) ? this.getMonthNumber(monthA) - 1 : 0,
              dayA || 1
            );

            const dateB = new Date(
              yearB || 0,
              (monthB && monthB.length == 3) ? this.getMonthNumber(monthB) - 1 : 0,
              dayB || 1
            );

            return dateA - dateB;
          });

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="fileData">' + item.link + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '</tr>';
          });
          break;
        case 4:
          // Sort by Source - show Source and Date in the navigation table
          navHeader = `
            <div id="column1">Source</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.flatMap(item => {
            return item.source.flatMap(person => {
              const lastNames = person.person.last.filter(lastName => {
                return !lastName.type || lastName.type !== "married";
              });

              return lastNames.map(lastName => {
                // sort by date received from the source
                const { year, month, day } = person.received;

                // Handle missing components by providing default values
                const dateSort = new Date(
                  year || 0,
                  (month && month.length == 3) ? this.getMonthNumber(month) - 1 : 0,
                  day || 1
                );

                return {
                  person: { ...person.person },
                  lastName: lastName.last,
                  received: person.received,
                  accession: item.accession,
                  categories: item.categories,
                  type: item.type,
                  dateSort
                };
              });
            });
          }).sort((a, b) => {
            // Compare by accessions.item.source.person.last.lastName, person.first, and then date
            const lastNameComparison = a.lastName.localeCompare(b.lastName);
            if (lastNameComparison !== 0) {
              return lastNameComparison;
            }

            const firstComparison = (a.person.first || '').localeCompare(b.person.first || '');
            if (firstComparison !== 0) {
              return firstComparison;
            }

            return a.dateSort - b.dateSort;
          });
          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="descData">' + personText(item.person) + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.received) + '</div></td>' +
              '</tr>';
          });
          break;
        case 5:
          // Sort by Accession - show Accession number and ? in the navigation table
          navHeader = `
            <div id="column1">Accession</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.sort((a, b) => {
            // Compare by accession left padded to 6 characters
            const paddedAccessionA = ('    ' + a.accession).substring(a.accession.length, a.accession.length + 6);
            const paddedAccessionB = ('    ' + b.accession).substring(b.accession.length, b.accession.length + 6);

            return paddedAccessionA.localeCompare(paddedAccessionB);

            // Compare by date
            const { year: yearA, month: monthA, day: dayA } = a.date;
            const { year: yearB, month: monthB, day: dayB } = b.date;

            // Handle missing components by providing default values
            const dateA = new Date(
              yearA || 0,
              (monthA && monthA.length == 3) ? this.getMonthNumber(monthA) - 1 : 0,
              dayA || 1
            );

            const dateB = new Date(
              yearB || 0,
              (monthB && monthB.length == 3) ? this.getMonthNumber(monthB) - 1 : 0,
              dayB || 1
            );

            return dateA - dateB;
          });

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="fileData">' + item.accession + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '</tr>';
          });
          break;
        case 6:
          // Sort by Category - show Category and Date in the navigation table
          // Sort by Person (last, first) and date - show Name and Date in the navigation table
          navHeader = `
            <div id="column1">Person</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          // This is a copy of case 1 with the addition of a filter by selectedCategory
          sortedItems = this.accessionJSON.accessions.item
            // Filter by selectedCategory
            .filter(item => item.categories.includes(selectedCategory))
            .flatMap(item => {
              return item.person.flatMap(person => {
                const lastNames = person.last.filter(lastName => {
                  return !lastName.type || lastName.type !== "married";
                });

                return lastNames.map(lastName => {
                  const { year, month, day } = item.date;

                  // Handle missing components by providing default values
                  const dateSort = new Date(
                    year || 0,
                    (month && month.length == 3) ? this.getMonthNumber(month) - 1 : 0,
                    day || 1
                  );

                  return {
                    person: { ...person },
                    lastName: lastName.last,
                    date: item.date,
                    accession: item.accession,
                    categories: item.categories,
                    type: item.type,
                    dateSort
                  };
                });
              });
            })
            .sort((a, b) => {
            // Compare by person.last, person.first, and then date
            const lastComparison = a.lastName.localeCompare(b.lastName);
            if (lastComparison !== 0) {
              return lastComparison;
            }

            const firstComparison = (a.person.first || '').localeCompare(b.person.first || '');
            if (firstComparison !== 0) {
              return firstComparison;
            }

            return a.dateSort - b.dateSort;
          });
          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + '" categories="' + item.categories + '">' +
              '<td><div class="descData">' + personText(item.person) + '</div></td>' +
              '<td><div class="dateData">' + dateText(item.date) + '</div></td>' +
              '</tr>';
          });
          break;
        default:
          console.log('Invalid sortBy option');
          break;
      }

      htmlOutput += '</tbody></table>';
      return {tableBody: htmlOutput, navHeader: navHeader};
    } catch (error) {
      console.log('Error in AccessionClass.transformToHtml. ', error);
    }
  } // transformToHtml

  getCommands(sourceDir, destDir, selectedCategory) {
    let commandOutput = `
    mkdir ${destDir}/audio
    mkdir ${destDir}/photo
    mkdir ${destDir}/video
    `;
    var sortedItems = '';
    sortedItems = this.accessionJSON.accessions.item
      // Filter by selectedCategory if it is not '*'
      .filter(item => selectedCategory === '*' || item.categories.includes(selectedCategory))
      .map(item => {
        return {
          type: item.type,
          link: item.link
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        } else {
          return a.link.localeCompare(b.link);
        }
      });
    // Iterate over sorted items and build the command output
    sortedItems.forEach(item => {
      switch (item.type) {
        case "photo":
          commandOutput += `
          ln ${sourceDir}/photo/${item.link} ${destDir}/photo`;
          break;
        case "tape":
          commandOutput += `
          ln ${sourceDir}/audio/${item.link} ${destDir}/audio`;
          break;
        case "video":
          commandOutput += `
          ln ${sourceDir}/video/${item.link} ${destDir}/video`;
          break;
      }
    });
    return commandOutput;
  }

  getAccessions(selectedCategory) {
    let accessionsOutput = {accessions: {item: []}};
    var sortedItems = '';
    // The category is used to filter the accessions, and to provide a title for the output
    const foundCategory = this.categories.find(c => c.value === selectedCategory);
    if (!foundCategory) {
      console.log('getAccessions: category not found: ' + selectedCategory)
      return accessionsOutput;
    }
    accessionsOutput.accessions.title = foundCategory.title
    sortedItems = this.accessionJSON.accessions.item
      // Filter by selectedCategory if it is not '*'
      .filter(item => selectedCategory === '*' || item.categories.includes(selectedCategory))
      .map(item => {
        return {
          ...item
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        } else {
          return a.link.localeCompare(b.link);
        }
      });
    // Iterate over sorted items and build the command output
    sortedItems.forEach(item => {
        item.categories = []
        accessionsOutput.accessions.item.push(item)
    });
    return accessionsOutput;
  }

  getMonthNumber(monthAbbreviation) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthAbbreviation) + 1;
  }

  getJSONItem(itemNumber, callback) {
    let oneItem
    let items = this.accessionJSON.accessions.item.filter(item => {
      return item.accession === itemNumber
    })
    if (items.length > 1) {
      console.log('getJSONItem: ' + items.length + ' items for accession: ' + itemNumber)
    }
    callback(items[0])
  }

  getJSONForLink(link, callback) {
    let oneItem
    let items = this.accessionJSON.accessions.item.filter(item => {
      return item.link === link
    })
    if (items.length > 1) {
      console.log('getJSONForLInk: ' + items.length + ' items for link: ' + link)
    }
    callback(items[0])
  }

  getJSONReferencesForLink(link) {
    // get a list of items in playlist entries that refer to this link
    // enables showing the photo while the audio or video is playing
    let oneItem
    let refs = []
    if (this.accessionJSON.accessions.item) {
      this.accessionJSON.accessions.item.forEach(item => {
        // playlist contains an entry array
        if (item.playlist) {
          item.playlist.entry.forEach(entry => {
            if (entry.ref === link) {
              refs.push({
                entry: {
                  ref: item.link,
                  starttime: entry.starttime,
                  duration: entry.duration
                }
              })
            }
          })
        }
      })
      refs.sort((a, b) => {
        let rv = 0
        if (a.entry.starttime < b.entry.starttime) { rv = -1 }
        if (a.entry.starttime > b.entry.starttime) { rv = 1 }
        return rv
      })
    }
    return refs
  }
}