import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { AppendString } from './AppendString.js';
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// const __dirname = import.meta.dirname;
const { copyright, version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')));

const detailTemplate = '<table id="prevData" summary="preview data">' +
'<tr><td class="detailCol1">Desc:</td><td class="detailCol2" id="desc">{{description}}</td></tr>' +
'<tr><td>People:</td><td id="people">{{peopleDisplay}}</td></tr>' +
'<tr><td>Date:</td><td id="date">{{dateDisplay}}</td></tr>' +
'<tr><td>Location:</td><td id="locatn"><a target="newWindow" href="https://maps.google.com/maps/search/{{locationDisplay}}">{{locationDisplay}}</a></td></tr>' +
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
'<tr class="detail"><td>Source:</td><td id="itemSource">{{sourceDisplay}}</td></tr>' +
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

  // If name is not type="married" and there is an array then nonmarried names are in parenthesis.
  static lastName(lastObj) {
    let lastStr = new AppendString(' ')
    // iterate over the last Name array
    lastObj.forEach(lastName => {
      if (lastObj.length === 1) {
        lastStr.add(lastName.last)
      } else {
        if (lastName.type) {
          if (lastName.type === 'married') {
            lastStr.add(lastName.last)
          } else {
            console.log('unknown last name type: ' + lastName.type)
          }
        } else {
          if (lastName.last) {
            lastStr.add('(' + lastName.last + ')')
          }
        }
      }
    });
    return lastStr.string();
  } // lastName

  static personText(oneNode, includePosition = true) {
    var first = '';
    var last = '';
    if (oneNode.first) {
      first = oneNode.first;
    }
    if (includePosition && oneNode.position) {
      first = oneNode.position + " " + first;
    }
    if (oneNode.last) {
      last = ItemViewClass.lastName(oneNode.last)
    }
    return first + " " + last;
  } // personText

  static peopleList(personNodes) {
    var people = new AppendString(', ');
    personNodes.forEach(person => {
      people.add(ItemViewClass.personText(person));
    })
    return people.string();
  } // peopleList

  static locationText(oneNode) {
    var lText = '';
    var detail;
    var city;
    var state;

    detail = oneNode.detail
    city = oneNode.city
    state = oneNode.state

    if (detail) {
      detail = detail;
      if ((city) ||
        (state))
        detail = detail + ", ";
    } else
      detail = '';

    if (city) {
      city = city;
      if (state)
        city = city + ", ";
    } else
      city = '';

    if (state)
      state = state;
    else
      state = '';

    lText = detail + city + state;
    return lText;
  } // locationText

  static showLocations(locationArray) {
    var locationString = new AppendString(', ')
    locationArray.forEach((location) => {
      locationString.add(ItemViewClass.locationText(location))
    })
    return locationString.string()
  } // showLocations

  showNodeDescription() {
    var sourceText = new AppendString(', ')
    var receivedText = new AppendString(', ')
    if (this.itemJSON.source) {
      this.itemJSON.source.forEach((itemSource) => {
        sourceText.add(ItemViewClass.personText(itemSource.person))
        receivedText.add(ItemViewClass.dateText(itemSource.received))
      })
    }

    let dataObject = {
      peopleDisplay: ItemViewClass.peopleList(this.itemJSON.person),
      dateDisplay: ItemViewClass.dateText(this.itemJSON.date),
      locationDisplay: ItemViewClass.showLocations(this.itemJSON.location),
      sourceDisplay: sourceText.string(),
      receivedDisplay: receivedText.string(),
      version: version,
      copyright: copyright,
      reflist: this.accessionClass.getReferencesForLink(this.getLink()),
      collections: this.accessionClass.collections.getCollectionKeys(this.itemJSON.accession),
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
          } catch (err) {
            viewObject.mediaTag = 'An error occurred reading the photo. ' + err;
          }
          break;
        case 'tape':
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
    if (formJSON.locationDetail || formJSON.locationCity || formJSON.locationState) {
      itemJSON.location[0] = {
        detail: formJSON.locationDetail,
        city: formJSON.locationCity,
        state: formJSON.locationState
      };
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
