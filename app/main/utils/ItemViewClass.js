import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { AppendString } from './AppendString.js';
import { formatLastName, formatPersonName } from '../../shared/personHelpers.js';
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// const __dirname = import.meta.dirname;
const { copyright, version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')));

const detailTemplate = '<table id="prevData" summary="preview data">' +
'<tr><td class="detailCol1">Desc:</td><td class="detailCol2" id="desc">{{description}}</td></tr>' +
'<tr><td>People:</td><td id="people">{{{peopleDisplay}}}</td></tr>' +
'<tr><td>Date:</td><td id="date">{{dateDisplay}}</td></tr>' +
'<tr><td>Location:</td><td id="locatn">{{{locationLinks}}}</td></tr>' + // Use triple curly braces to render HTML as is
'<tr class="detail"><td>Collections: </td><td id="collections">{{collections}}</td></tr>' +
'<tr class="detail"><td>Accession:</td><td id="accession">{{accession}}</td></tr>' +
'<tr class="detail"><td>Link:</td><td id="link">{{link}}</td></tr>' +
'<tr class="detail"><td colspan="2"><button id="editMedia">Edit media</button></td></tr>' +
'{{#playlist}}' +
'{{#entry}}' +
'<tr><td>Playlist:</td><td><div class="playEntry">File: <span id="playlink">{{ref}}</span> start: <span id="playstart">{{starttime}}</span> duration: <span id="playduration">{{duration}}</span></div></td></tr>' +
'{{/entry}}' +
'{{/playlist}}' +
'{{#reflist}}' +
'{{#entry}}' +
'<tr><td>References:</td><td><div class="playEntry">File: <span id="playlink">{{ref}}</span> start: <span id="playstart">{{starttime}}</span> duration: <span id="playduration">{{duration}}</span></div></td></tr>' +
'{{/entry}}' +
'{{/reflist}}' +
'<tr class="detail"><td>Source:</td><td id="itemSource">{{{sourceDisplay}}}</td></tr>' +
'<tr class="detail"><td>Received:</td><td id="received">{{receivedDisplay}}</td></tr>' +
'<div class="prevDataCaption"><span>Media Details</span> <span><button id="openWebsite">Pedigree Website</button></span></div>' +
'</table>' +
'<p class="copyright">{{copyright}} ' +
'<a href="mailto:marvbudd@gmail.com">Marvin E Budd.</a> ' +
'Version {{version}}' +
'</p>'
const detailCompiled = Handlebars.compile(detailTemplate)

/**
 * Represents a class for handling item views.
 */
export class ItemViewClass {
  constructor(itemJSON, accessionClass) {
    this.itemJSON = itemJSON
    this.accessionClass = accessionClass
  } // constructor

  getType() {
    return this.itemJSON.type;
  } // getType
  
  getLink() {
    return this.itemJSON.link;
  } // getLink

  static dateText(oneNode) {
    var month;
    var day;
    var year;

    month = oneNode.month;
    day = oneNode.day;
    year = oneNode.year;

    if (day)
      day = day + " ";
    else
      day = '';
    if (month)
      month = month + " ";
    else
      month = '';
    if (year)
      year = year;
    else
      year = '';

    return day + month + year;
  } //dateText

  static personText(oneNode, includePosition = true, accessionClass = null, makeLinks = true) {
    // Resolve personID to person data if present
    let person = oneNode;
    if (oneNode.personID && accessionClass) {
      const resolvedPerson = accessionClass.getPerson(oneNode.personID);
      if (resolvedPerson) {
        // Merge resolved data with reference data (position, faceTag stay with reference)
        person = { ...resolvedPerson, ...oneNode };
      }
    }
    
    // Use centralized formatting
    const personName = formatPersonName(person, includePosition);
    
    // If person has TMGID and makeLinks is true, make it a clickable link
    if (personName && person.TMGID && accessionClass && makeLinks) {
      return `<a href="#" class="person-link" data-tmgid="${person.TMGID}">${personName}</a>`;
    }
    
    return personName;
  } // personText

  static peopleList(personNodes, accessionClass = null, makeLinks = true, showNumbers = false) {
    var people = new AppendString(', ');
    personNodes.forEach((person, index) => {
      let text = ItemViewClass.personText(person, true, accessionClass, makeLinks);
      if (showNumbers && text) {
        text = `${index + 1}. ${text}`;
      }
      // Add context if present
      if (text && person.context) {
        text = `${text} (${person.context})`;
      }
      people.add(text);
    })
    return people.string();
  } // peopleList

  static locationText(oneNode, suppressGPS = false, navColumn = false) {
    let lText = '';
    let gpsText = ''
    let detail = oneNode.detail
    let city = oneNode.city
    let state = oneNode.state

    // In nav column when sorted by location:
    // - If detail/city/state exist, show only those (suppress GPS)
    // - If ONLY GPS exists (no detail/city/state), show GPS
    if (navColumn && (detail || city || state)) {
      suppressGPS = true;
    }

    if (!suppressGPS) {
      // Handle both new format (latitude/longitude) and legacy format (gps string)
      if (oneNode.latitude && oneNode.longitude) {
        // New format: separate numeric fields, formatted to 6 decimal places
        gpsText = `${oneNode.latitude.toFixed(6)}, ${oneNode.longitude.toFixed(6)}`;
        gpsText += (detail || city || state) ? ", " : "";
      } else if (oneNode.gps) {
        // Legacy format: gps string
        gpsText = oneNode.gps;
        gpsText += (detail || city || state) ? ", " : "";
      } else {
        gpsText = '';
      }
    }
    if (detail) {
      detail += (city || state) ? ", " : "";
    } else {
      detail = '';
    }
    if (city) {
      city += state ? ", " : "";
    } else {
      city = '';
    }
    state = state || '';

    lText = gpsText + detail + city + state;
    return lText;
  } // locationText

  static showLocations(locationArray) {
    var locationString = new AppendString(', ')
    var locationLinks = new AppendString(', ')
    locationArray.forEach((location) => {
      const locationText = ItemViewClass.locationText(location)
      // Google likes either the gps or the text, not both
      // latlon format is from https://stackoverflow.com/questions/2660201/what-parameters-should-i-use-in-a-google-maps-url-to-go-to-a-lat-lon
      let locationSearch;
      if (location.latitude && location.longitude) {
        // New format: separate latitude/longitude fields
        locationSearch = `?q=${location.latitude},${location.longitude}&t=k`;
      } else if (location.gps) {
        // Legacy format: gps string
        locationSearch = `?q=${location.gps}&t=k`;
      } else {
        // No GPS data, use text address
        locationSearch = `?q=${ItemViewClass.locationText(location, true)}&t=k`;
      }
      locationLinks.add(`<a target="newWindow" href="https://maps.google.com${locationSearch}">${locationText}</a>`)
      locationString.add(ItemViewClass.locationText(location))
    })
    return { 'locationString': locationString.string(), 'locationLinks': locationLinks.string() }
  } // showLocations

  showNodeDescription() {
    var sourceText = new AppendString(', ')
    var receivedText = new AppendString(', ')
    if (this.itemJSON.source) {
      this.itemJSON.source.forEach((itemSource) => {
        // Resolve personID to person data
        if (itemSource.personID) {
          const personRef = { personID: itemSource.personID };
          sourceText.add(ItemViewClass.personText(personRef, false, this.accessionClass));
        }
        receivedText.add(ItemViewClass.dateText(itemSource.received))
      })
    }
    
    // Check if any person has face descriptors for this link
    const currentLink = this.itemJSON.link;
    const hasFaceTags = this.itemJSON.person && this.itemJSON.person.some(personRef => {
      if (!personRef.personID) return false;
      const person = this.accessionClass.getPerson(personRef.personID);
      if (!person || !person.faceBioData) return false;
      // Check if this person has a descriptor for the current link
      return person.faceBioData.some(d => d.link === currentLink && d.region);
    });
    
    let locationDisplay = ItemViewClass.showLocations(this.itemJSON.location)
    let dataObject = {
      'peopleDisplay': ItemViewClass.peopleList(this.itemJSON.person, this.accessionClass, true, hasFaceTags),
      'dateDisplay': ItemViewClass.dateText(this.itemJSON.date),
      'locationDisplay': locationDisplay.locationString,
      'locationLinks': locationDisplay.locationLinks,
      'sourceDisplay': sourceText.string(),
      'receivedDisplay': receivedText.string(),
      'version': version,
      'copyright': copyright,
      'reflist': this.accessionClass.getReferencesForLink(this.getLink()),
      'collections': this.accessionClass.collections.getCollectionKeys(this.itemJSON.link),
      ...this.itemJSON
    }
    return detailCompiled(dataObject)
  } // showNodeDescription

  getViewObject(callback) {
    let viewObject = {};
    let mediaPath;
    if (this.itemJSON) {
      viewObject.link = this.getLink();
      mediaPath = this.accessionClass.getMediaPath(this.itemJSON.type, viewObject.link);
      switch (this.itemJSON.type) {
        case 'photo':
          try {
            const data = fs.readFileSync(mediaPath);
            const imgEncoded = data.toString('base64');
            viewObject.mediaTag = `<a target="_blank" href="${mediaPath}"><img id="previewImg" alt="The Photo" src="data:image/jpg;base64,${imgEncoded}" /></a>`;
            
            // Add face tags data for photos
            viewObject.faceTags = this.getFaceRegionsData();
          } catch (err) {
            viewObject.mediaTag = 'An error occurred reading the photo. ' + err;
          }
          break;
        case 'audio':
          viewObject.mediaTag = `<audio id="previewAudio" alt="The Audio" controls><source src="${mediaPath}" type="audio/mp3" /></audio>`;
          break;
        case 'video':
          viewObject.mediaTag = `<video id="previewVideo" alt="The Video" controls><source src="${mediaPath}" type="video/mp4" /></video>`;
          break;
      }
      viewObject.descDetail = this.showNodeDescription();
      callback(viewObject);
    } else {
      callback('ItemViewClass:getViewObject - No itemJSON!!!');
    }
  } // getViewObject

  // Get face regions data with person names for rendering from persons faceBioData
  getFaceRegionsData() {
    if (!this.itemJSON.person || !this.accessionClass) return [];
    
    const faceTags = [];
    const currentLink = this.itemJSON.link;
    
    this.itemJSON.person.forEach((personRef, index) => {
      // Get person from library to access faceBioData
      if (personRef.personID) {
        const person = this.accessionClass.getPerson(personRef.personID);
        if (person && person.faceBioData) {
          // Find the descriptor for this specific link
          const descriptor = person.faceBioData.find(d => d.link === currentLink);
          if (descriptor && descriptor.region) {
            // Build person name using shared helper
            const name = formatPersonName(person, false);
            
            faceTags.push({
              index: index + 1,
              name: name,
              region: descriptor.region
            });
          }
        }
      }
    });
    
    return faceTags;
  } // getFaceRegionsData

  /**
   * Updates the item with the provided form data.
   * @param {Object} formJSON - The form data in JSON format.
   */
  updateItem(formJSON) {
    // accession and link are not updated intentionally, they are keys to the item
    let itemJSON = this.itemJSON;
    if (formJSON.description) {
      itemJSON.description = formJSON.description;
    }
    if (formJSON.personFirst || formJSON.personLast) {
      itemJSON.person.push({
        first: formJSON.personFirst,
        last: [{
          last: formJSON.personLast
        }]
      });
    }
    if (formJSON.dateYear || formJSON.dateMonth || formJSON.dateDay) {
      itemJSON.date = {
        month: formJSON.dateMonth,
        day: formJSON.dateDay,
        year: formJSON.dateYear
      };
    }
    if (formJSON.locationDetail || formJSON.locationCity || formJSON.locationState || 
        (formJSON.locationLatitude && formJSON.locationLongitude)) {
      const locationEntry = {
        detail: formJSON.locationDetail,
        city: formJSON.locationCity,
        state: formJSON.locationState
      };
      // Add GPS coordinates if provided
      if (formJSON.locationLatitude && formJSON.locationLongitude) {
        locationEntry.latitude = formJSON.locationLatitude;
        locationEntry.longitude = formJSON.locationLongitude;
      }
      itemJSON.location[0] = locationEntry;
    }
    if (formJSON.sourPersonFirst || formJSON.sourPersonLast || formJSON.sourYear || formJSON.sourMonth || formJSON.sourDay) {
      itemJSON.source.push({
        person: {
          first: formJSON.sourPersonFirst,
          last: [{
            last: formJSON.sourPersonLast
          }]
        },
        received: {
          month: formJSON.sourMonth,
          day: formJSON.sourDay,
          year: formJSON.sourYear
        }
      });
    }
  } // updateItem

  // get the form data for the item
  getFormJSON() {
    let itemJSON = this.itemJSON;

    let formJSON = {
      accession:   itemJSON.accession,
      link:        itemJSON.link,
      description: itemJSON.description,
      personFirst: itemJSON.person[0]?.first,
      personLast:  itemJSON.person[0]?.last[0]?.last,
      dateYear:    itemJSON.date.year,
      dateMonth:   itemJSON.date.month,
      dateDay:     itemJSON.date.day,
      locationDetail: itemJSON.location[0]?.detail,
      locationCity: itemJSON.location[0]?.city,
      locationState: itemJSON.location[0]?.state,
      sourPersonFirst: itemJSON.source[0]?.person?.first,
      sourPersonLast: itemJSON.source[0]?.person?.last[0]?.last,
      sourYear:    itemJSON.source[0]?.received?.year,
      sourMonth:   itemJSON.source[0]?.received?.month,
      sourDay:     itemJSON.source[0]?.received?.day
    };
    return formJSON;
  } // getformJSON
} // ItemViewClass
