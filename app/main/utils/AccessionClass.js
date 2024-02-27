import path from 'path';
import fs from 'fs';
import { ItemViewClass } from './ItemViewClass.js';
import { CollectionsClass } from './CollectionsClass.js';

// AccessionClass is a class that reads an accession JSON file and provides methods to access the data
export class AccessionClass {
  constructor(accessionFilename) {
    this.accessionFilename = accessionFilename
    this.accessionJSON = JSON.parse(fs.readFileSync(this.accessionFilename).toString())
    this.collections = new CollectionsClass(path.dirname(accessionFilename))
    this.collections.readCollections()
  } // constructor

  // Call the persistence methods here before the class is destroyed
  saveAccessions() {
    this.collections.saveCollections();
  } // saveAccessions
  
  // adds or remove an item from a collection - called on double click
  toggleItemInCollection(collectionKey, accession) {
    const collection = this.collections.getCollection(collectionKey)
    if (collection) {
      let itemView = this.getItemView(accession)
      collection.getItem(accession) ? collection.removeAccession(accession) : collection.addItem(accession, itemView.getLink())
    } else {
      console.log('AccessionClass:toggleItemIncollection - Collection not found: ' + collectionKey)
    }
  } // toggleItemInCollection
  
  // getcollections returns an array of unique collections the accessionJSON
  getCollections() {
    let collections = [];
    this.collections.collections.forEach(collection => {
      collections.push({value: collection.key, text: collection.text});
    })
    return collections
  } // getCollections

  // getTitle returns accessionJSON title
  getTitle() {
    return this.accessionJSON.accessions.title
  } // getTitle
  
  /**
   * Transforms the data into HTML for the left hand pane based on the selection criteria.
   * 
   * sortBy - The sorting criteria. 0 for sorting by date, 1 for sorting by person and date, 2 for sorting by location, 3 for sorting by file, 4 for sorting by source.
   * returns {string} The HTML output.
   */
    // prior to Jan2024 a transform method was used to create the HTML from xml/xslt but that was unreliable
  transformToHtml(sortBy) {
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
              type: item.type,
              accession: item.accession,
              person: item.person,
              date: item.date,
              dateSort
            };
          }).sort((a, b) => a.dateSort - b.dateSort);

          // Build the HTML output using map and join
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
              '<td><div class="descData">' + ItemViewClass.peopleList(item.person) + '</div></td>' +
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
              return person.last.map(lastName => {
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
                  type: item.type,
                  dateSort
                };
              });
            });
          }).sort((a, b) => {
            // Compare by last, first, and then date
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
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="descData">' + ItemViewClass.personText(item.person, false) + '</div></td>' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
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
              const { year, month, day } = item.date;

              // Handle missing components by providing default values
              const dateSort = new Date(
                year || 0,
                (month && month.length == 3) ? this.getMonthNumber(month) - 1 : 0,
                day || 1
              );

              const { state, city, detail } = location;

              return {
                location: { ...location },
                state: state || '',
                city: city || '',
                detail: detail || '',
                date: item.date,
                accession: item.accession,
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

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="fileData">' + ItemViewClass.locationText(item.location) + '</div></td>' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
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
            // Compare by link
            const fileComparison = (a.link || '').localeCompare(b.link || '');
            return fileComparison;
          });

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="fileData">' + item.link + '</div></td>' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
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
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="descData">' + ItemViewClass.personText(item.person, false) + '</div></td>' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.received) + '</div></td>' +
              '</tr>';
          });
          break;
        case 5:
          // Sort by Accession - show Accession number and date in the navigation table
          navHeader = `
            <div id="column1">Accession</div>
            <div id="column2" class="dateRight">Date</div>
          `;
          sortedItems = this.accessionJSON.accessions.item.sort((a, b) => {
            // Extract the numeric part of the accession
            const numericPartA = parseInt(a.accession.match(/\d+/)[0]);
            const numericPartB = parseInt(b.accession.match(/\d+/)[0]);

            // Compare the numeric part
            if (numericPartA !== numericPartB) {
              return numericPartA - numericPartB;
            }

            // Compare the alpha characters part
            const alphaPartA = a.accession.replace(/\d+/g, '');
            const alphaPartB = b.accession.replace(/\d+/g, '');

            return alphaPartA.localeCompare(alphaPartB);
          });

          // Iterate over sorted items and build the HTML output
          sortedItems.forEach(item => {
            htmlOutput += '<tr class="' + item.type + '" accession="' + item.accession + 
              '" collections="' + this.collections.getCollectionKeys(item.accession) + '">' +
              '<td><div class="fileData">' + item.accession + '</div></td>' +
              '<td><div class="dateData">' + ItemViewClass.dateText(item.date) + '</div></td>' +
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

  getCommands(sourceDir, destDir, selectedCollection) {
    let commandOutput = `
    mkdir ${destDir}/audio
    mkdir ${destDir}/photo
    mkdir ${destDir}/video
    `;
    var sortedItems = '';
    let collection = this.collections.getCollection(selectedCollection)
    sortedItems = collection.itemKeys.map(itemKey => {
      const itemView = this.getItemView(itemKey.accession, itemKey.link);
      return {
        type: itemView.getType(),
        link: itemView.getLink()
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
  }  // getCommands

  getAccessions(selectedCollection) {
    let accessionsOutput = {accessions: {item: []}};
    var sortedItems = '';
    let collection = this.collections.getCollection(selectedCollection)
    accessionsOutput.accessions.title = collection.title
    sortedItems = collection.itemKeys.map(itemKey => {
      const itemView = this.getItemView(itemKey.accession, itemKey.link);
      return {
        ...itemView.itemJSON
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
      accessionsOutput.accessions.item.push(item)
    });
    return accessionsOutput;
  } // getAccessions

  getMonthNumber(monthAbbreviation) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthAbbreviation) + 1;
  } // getMonthNumber

  // getItemView returns an ItemViewClass object for the given accession or link
  getItemView(accession, link) {
    let item;
    if (accession) {
      item = this.accessionJSON.accessions.item.find(item => item.accession === accession);
      if (link && item.link !== link) {
        console.log('AccessionClass getItemView: item.link mismatch with collection. accession: ' + accession + ', collection link: ' + link + ', item: ' + item.link);
      }
    } else if (link) {
      item = this.accessionJSON.accessions.item.find(item => item.link === link);
    }
    if (!item) {
      console.log('getItemView: item not found: ' + accession);
      return null;
    }
    item.collections = this.collections.getCollectionKeys(item.accession);
    return new ItemViewClass( item, this );
  } // getItemView
      
  // create an array of playlist items that refer to this link (photos that are described in audio or video)
  // enables showing the photo while the audio or video is playing
  getReferencesForLink(link) {
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
  } // getReferencesForLink
}
