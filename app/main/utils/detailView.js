const Handlebars = require('handlebars')
const fs = require( 'fs' )
const path = require( 'path' );
const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')))
// const version = process.env.npm_package_version

const detailTemplate = '<table id="prevData" summary="preview data">' +
      '<tr><td class="detailCol1">Desc:</td><td class="detailCol2" id="desc">{{description}}</td></tr>' +
      '<tr><td>People:</td><td id="people">{{peopleDisplay}}</td></tr>' +
      '<tr><td>Date:</td><td id="date">{{dateDisplay}}</td></tr>' +
      '<tr><td>Location:</td><td id="locatn"><a target="newWindow" href="https://maps.google.com/maps/search/{{locationDisplay}}">{{locationDisplay}}</a></td></tr>' +
      '<tr class="detail"><td>Categories: </td><td id="categ">{{$/categories}}</td></tr>' +
      '<tr class="detail"><td>Accession:</td><td id="acsn">{{accession}}</td></tr>' +
      '<tr class="detail"><td>Source:</td><td id="itemSource">{{sourceDisplay}}</td></tr>' +
      '<tr class="detail"><td>Received:</td><td id="received">{{receivedDisplay}}</td></tr>' +
      '<tr class="detail"><td>Link:</td><td id="link">{{link}}</td></tr>' +
      '{{#playlist}}' +
      "{{#entry}}" +
      '<tr class="detail"><td>Playlist:</td><td><div class="playEntry">File: <span id="playlink">{{ref}}</span> start: <span id="playstart">{{starttime}}</span> duration: <span id="playduration">{{duration}}</span></div></td></tr>' +
      '{{/entry}}' +
      '{{/playlist}}' +
      '<caption>Media Description: Double click to toggle details.</caption>' +
      '</table>' +
      '<p class="copyright">Copyright (c) 2001-2022 ' +
      '<a href="mailto:marvbudd@gmail.com">Marvin E Budd.</a> ' +
      'Version {{version}}' +
      '</p>'
const detailCompiled = Handlebars.compile(detailTemplate)

function dateText(oneNode) {
  var dText = '';
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

  dText = day + month + year;
  return dText;
} //dateText

function lastName( lastObj ) {
  let last = '';  
  if ( Array.isArray(lastObj) ) {
    for ( var i = 0; i < lastObj.length; i++ ) {
      if ( lastObj[i].$ ) {
        if (lastObj[i]) {
          if (last == '') {
            last = lastObj[i]._
          } else {
            last = last + ' ' + lastObj[i]._
          }
        }
      } else {
        if (lastObj[i]) {
          if (last == '') {
            last = "(" + lastObj[i] + ")"
          } else {
            last = last + " (" + lastObj[i] + ")";
          }
        }
      }
    }
  } else {
    last = lastObj;
  }
  return last;
} // If name is not type="married" and there is an array then nonmarried names are in parenthesis.

function personText(oneNode) {
  var people = '';
  var first;
  var last = '';
  var lastNodes;
  var position;
  var married;

  first = oneNode.first
  position = oneNode.position
  lastNodes = oneNode.last

  if (first) {
    first = first;
  } else {
    first = '';
  }
  if (position) {
    first = position + " " + first;
  }
  if (lastNodes) {
    last = lastName( lastNodes )
  }
  people = first + " " + last;
  return people;
}

function peopleList(itemNode) {
  var people = '';
  var personNodes = itemNode.person;

  if ( Array.isArray( personNodes ) ) {
    var personLen = personNodes.length;
    for (var i = 0; i < personLen; i++) {
      if (people != '')
        people = people + ", ";
      people = people + personText(personNodes[i]);
    }
  } else {
    people = personText(personNodes)
  }
  return people;
}

function locationText(oneNode) {
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

export function showNodeDescription( itemObject ) {
  var sourceText = '';
  var receivedText = '';
  if ( Array.isArray(itemObject.source) ) {
    var len = itemObject.source.length;
    for (var i = 0; i < len; i++) {
      var itemSource = itemObject.source[i];
      if (itemSource) {
        if (sourceText == '') {
          sourceText = personText(itemSource.person);
        } else {
          sourceText += ", " + personText(itemSource.person);
        }
        if (receivedText == '') {
          receivedText = dateText( itemSource.received )
        } else {
          receivedText += ', ' + dateText( itemSource.received );
        }
      }
    }
  } else {
    sourceText = personText(itemObject.source.person)
    receivedText = dateText(itemObject.source.received)
  }

  let dataObject = {
    peopleDisplay: peopleList( itemObject ),
    dateDisplay: dateText( itemObject.date ),
    locationDisplay: itemObject.location ? locationText( itemObject.location ) : '',
    sourceDisplay: sourceText,
    receivedDisplay: receivedText,
    // version: process.env.npm_package_version,
    version: version,
    ...itemObject
  }
  return detailCompiled(dataObject)
} // showNodeDescription