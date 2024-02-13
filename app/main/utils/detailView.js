const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path');
const nconf = require( 'nconf' );
import url from 'url'
import { AppendString } from './AppendString.js'
const { copyright, version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')))
// const version = process.env.npm_package_version

const detailTemplate = '<table id="prevData" summary="preview data">' +
  '<tr><td class="detailCol1">Desc:</td><td class="detailCol2" id="desc">{{description}}</td></tr>' +
  '<tr><td>People:</td><td id="people">{{peopleDisplay}}</td></tr>' +
  '<tr><td>Date:</td><td id="date">{{dateDisplay}}</td></tr>' +
  '<tr><td>Location:</td><td id="locatn"><a target="newWindow" href="https://maps.google.com/maps/search/{{locationDisplay}}">{{locationDisplay}}</a></td></tr>' +
  '<tr class="detail"><td>Categories: </td><td id="categ">{{#each categories}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</td></tr>' +
  '<tr class="detail"><td>Accession:</td><td id="acsn">{{accession}}</td></tr>' +
  '<tr class="detail"><td>Source:</td><td id="itemSource">{{sourceDisplay}}</td></tr>' +
  '<tr class="detail"><td>Received:</td><td id="received">{{receivedDisplay}}</td></tr>' +
  '<tr class="detail"><td>Link:</td><td id="link">{{link}}</td></tr>' +
  '{{#playlist}}' +
  '{{#entry}}' +
  '<tr class="detail"><td>Playlist:</td><td><div class="playEntry">File: <span id="playlink">{{ref}}</span> start: <span id="playstart">{{starttime}}</span> duration: <span id="playduration">{{duration}}</span></div></td></tr>' +
  '{{/entry}}' +
  '{{/playlist}}' +
  '{{#reflist}}' +
  '{{#entry}}' +
  '<tr class="detail"><td>References:</td><td><div class="playEntry">File: <span id="playlink">{{ref}}</span> start: <span id="playstart">{{starttime}}</span> duration: <span id="playduration">{{duration}}</span></div></td></tr>' +
  '{{/entry}}' +
  '{{/reflist}}' +
  '<caption><a href="{{ssURL}}" target="_blank">Second Site</a>  Media Description.</caption>' +
  '</table>' +
  '<p class="copyright">{{copyright}} ' +
  '<a href="mailto:marvbudd@gmail.com">Marvin E Budd.</a> ' +
  'Version {{version}}' +
  '</p>'
const detailCompiled = Handlebars.compile(detailTemplate)

export function dateText(oneNode) {
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

export function lastName(lastObj) {
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
} // If name is not type="married" and there is an array then nonmarried names are in parenthesis.

export function personText(oneNode) {
  var first = '';
  var last = '';
  if (oneNode.first) {
    first = oneNode.first;
  }
  if (oneNode.position) {
    first = oneNode.position + " " + first;
  }
  if (oneNode.last) {
    last = lastName(oneNode.last)
  }
  return first + " " + last;
}

export function peopleList(personNodes) {
  var people = new AppendString(', ');
  personNodes.forEach(person => {
      people.add( personText(person) );
  })
  return people.string();
}

export function locationText(oneNode) {
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

export function showLocations(locationArray) {
  var locationString = new AppendString(', ')
  locationArray.forEach((location) => {
    locationString.add( locationText(location) )
  })
  return locationString.string()
} // showLocations

export function showNodeDescription(itemObject) {
  var sourceText = new AppendString(', ')
  var receivedText = new AppendString(', ')
  if (itemObject.source) {
    itemObject.source.forEach((itemSource) => {
      sourceText.add( personText(itemSource.person) )
      receivedText.add( dateText(itemSource.received) )
    })
  }

  let dataObject = {
    peopleDisplay: peopleList(itemObject.person),
    dateDisplay: dateText(itemObject.date),
    locationDisplay: showLocations(itemObject.location),
    sourceDisplay: sourceText.string(),
    receivedDisplay: receivedText.string(),
    version: version,
    copyright: copyright,
    ssURL: url.pathToFileURL( path.resolve( path.dirname( nconf.get('db:accessionsPath') ), 'website', 'index.htm' ) ).href,
    ...itemObject
  }
  return detailCompiled(dataObject)
} // showNodeDescription