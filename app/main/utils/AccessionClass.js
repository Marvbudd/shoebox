import path from 'path';
import fs from 'fs';
import url from 'url';
import exifr from 'exifr';
import { ItemViewClass } from './ItemViewClass.js';
import { CollectionsClass } from './CollectionsClass.js';

const subdirectories = {
  photo: 'photo',
  tape: 'audio',
  video: 'video'
};

// AccessionClass is a class that reads an accession JSON file and provides methods to access the data
export class AccessionClass {
  constructor(accessionFilename, title) {
    if (!title) {
      const tempDate = new Date();
      title = 'Accessions ' + tempDate.getFullYear() + tempDate.toLocaleString('default', { month: 'short' }) + tempDate.getDate();
    }
    if (!fs.existsSync(accessionFilename)) {
      console.error(`AccessionClass: Accessions don't exist in ${accessionFilename}`)
      this.accessionJSON = {
        accessions: {
          title, 
          item: []
        }};
    } else {
      this.accessionJSON = JSON.parse(fs.readFileSync(accessionFilename).toString())
    }
    this.accessionsChanged = false
    this.accessionFilename = accessionFilename
    this.collections = new CollectionsClass(path.dirname(accessionFilename))
    this.collections.readCollections()
    // find the highest accession number. We only use the first numeric part of the accession
    this.maxAccession = this.accessionJSON.accessions.item.length > 0 ? Math.max(...this.accessionJSON.accessions.item.map(item => parseInt(item.accession.match(/\d+/)[0]))) : 0;
  } // constructor

  // Call the persistence methods here before the class is destroyed
  saveAccessions() {
    this.collections.saveCollections();
    if (this.accessionsChanged) {
      fs.writeFileSync(this.accessionFilename, JSON.stringify(this.accessionJSON, null, 2))
      this.accessionsChanged = false
    }
  } // saveAccessions
  
  // adds or remove an item from a collection - called on double click
  toggleItemInCollection(collectionKey, accession) {
    const collection = this.collections.getCollection(collectionKey)
    if (collection) {
      let itemView = this.getItemView(accession)
      if (!itemView) {
        console.error('AccessionClass:toggleItemIncollection - Item not found: ' + accession)
        return
      }
      collection.getItem(accession) ? collection.removeAccession(accession) : collection.addItem(accession, itemView.getLink())
    } else {
      console.error('AccessionClass:toggleItemIncollection - Collection not found: ' + collectionKey)
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

  getWebsite() {
    return url.pathToFileURL(path.resolve(path.dirname(this.accessionFilename), 'website', 'index.htm')).href
  } // getWebsite

  // getMediaDirectory returns the path to the provided type and link
  getMediaPath(type, link) {
    return path.resolve(path.dirname(this.accessionFilename), subdirectories[type], link);
  } // getMediaPath

  // addMediaFiles adds media files to the accessionJSON 
  async addMediaFiles(formJSON) {
    try {
      const subdirectoryKeys = Object.keys(subdirectories);
      await Promise.all(subdirectoryKeys.map(async (type) => {
        const directoryPath = path.join(formJSON.updateFocus, subdirectories[type]);
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
          try {
            await this.createItem(file, directoryPath, type, formJSON);
          }
          catch (error) {
            console.error('Error in addMediaFiles: ', error);
          }
        }
      }));
    } catch (error) {
      console.error('Error in addMediaFiles: ', error);
    }
  } // End of addMediaFiles function

  async createItem(file, directoryPath, type, formJSON) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    const link = path.basename(file);
    // Use the exifr library to extract metadata
    let linkExists = this.accessionJSON.accessions.item.some(item => item.link === link);
    if (!linkExists) {
      // if the date isn't provided, use the file date
      if (!formJSON.dateYear && !formJSON.dateMonth && !formJSON.dateDay) {
        const date = stats.birthtime;
        formJSON.dateYear = date.getFullYear();
        formJSON.dateMonth = date.toLocaleString('default', { month: 'short' });
        formJSON.dateDay = date.getDate();
      }
      try {
        let metadata;
        if (type === 'photo') {
          metadata = await exifr.parse(filePath, { gps: true, exif: true });
          // metadata = await exifr.parse(filePath, { pick: ['latitude','GPSLatitudeRef','longitude','GPSLongitudeRef','ImageDescription']} );
        }
        const location = (metadata?.latitude && metadata?.longitude) ? `GPS: ${metadata.latitude.toFixed(6)} ${metadata.GPSLatitudeRef} ${metadata.longitude.toFixed(6)} ${metadata.GPSLongitudeRef}` : '';
        const description = metadata?.ImageDescription || '';
        if (location) {
          formJSON.locationDetail = location;
        }
        if (description) {
          formJSON.description = description;
        }
        this.maxAccession++;
        const item = {
          link,
          "person": [],
          "accession": this.maxAccession.toString(),
          type,
          "location": [
          ],
          "source": []
        };
        let itemView = new ItemViewClass(item, this);
        itemView.updateItem(formJSON) // update the item with the formJSON
        this.accessionJSON.accessions.item.push(itemView.itemJSON);
        this.accessionsChanged = true
      }
      catch (error) {
        console.error('Error in createItem: ', error);
      }
    }
  } // End of createItem function

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
              '<td><div class="date">' + ItemViewClass.dateText(item.date) + '</div></td>' +
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
          console.error('Invalid sortBy option');
          break;
      }

      htmlOutput += '</tbody></table>';
      return {tableBody: htmlOutput, navHeader: navHeader};
    } catch (error) {
      console.error('Error in AccessionClass.transformToHtml. ', error);
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
        console.error(`AccessionClass getItemView: item.link mismatch with collection. accession: ${accession}, collection link: ${link}, item: ${item.link}`);
      }
    } else if (link) {
      item = this.accessionJSON.accessions.item.find(item => item.link === link);
    }
    if (!item) {
      console.error(`AccessionClass.getItemView: item not found: ${accession}, ${link}`);
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

  // updateCollection updates all items in a collection from a formJSON
  updateCollection(formJSON) {
    let collection = this.collections.getCollection(formJSON.updateFocus)
    if (collection) {
      collection.itemKeys.forEach(key => {
        // delegate as if only one was updated
        formJSON.accession = key.accession
        this.updateAccession(formJSON)
      });
    }
  } // updateCollection

  // updateItem updates an item from a formJSON
  updateAccession(formJSON) {
    let itemView = this.getItemView(formJSON.accession)
    if (itemView) {
      itemView.updateItem(formJSON)
      // replace the item in accessionJSON
      let index = this.accessionJSON.accessions.item.findIndex(item => item.accession === formJSON.accession)
      if (index >= 0) {
        this.accessionJSON.accessions.item[index] = itemView.itemJSON
        this.accessionsChanged = true
      } else {
        console.error('AccessionClass:updateItem - item not found: ' + formJSON.accession)
      }
    }
  } // updateItem  

  // Create a new collection
  createCollection(collectionKey, title, text) {
    this.collections.createCollection(collectionKey, title, text)
  }

  // Delete existing collection
  deleteCollection(collectionKey, title, text) {
    this.collections.deleteCollection(collectionKey, title, text)
  } //
} // AccessionClass
