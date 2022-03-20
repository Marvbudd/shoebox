const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path');
const nconf = require( 'nconf' );
import url from 'url'
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
  '<p class="copyright">Copyright (c) 2001-2022 ' +
  '<a href="mailto:marvbudd@gmail.com">Marvin E Budd.</a> ' +
  'Version {{version}}' +
  '</p>'
const detailCompiled = Handlebars.compile(detailTemplate)

function dateText(oneNode) {
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

class AppendString {
  constructor(separator) {
    this.last = ''
    this.separator = separator
  }
  add = (str) => {
    if (this.last == '') {
      this.last = str
    } else {
      this.last = this.last + this.separator + str
    }
  }
  string = () => {
    return this.last
  }
}

function lastName(lastObj) {
  let lastStr = new AppendString(' ')
  if (Array.isArray(lastObj)) {
    for (var i = 0; i < lastObj.length; i++) {
      if (typeof (lastObj[i]) === 'object') {
        if (lastObj[i].$.type === 'married') {
          if (lastObj[i]._) {
            lastStr.add(lastObj[i]._)
          }
        } else {
          console.log('unknown last name type: ' + lastObj[i].$.type)
        }
      } else {
        if (lastObj[i]) {
          lastStr.add('(' + lastObj[i] + ')')
        }
      }
    }
  } else {
    if (typeof (lastObj) === 'object') {
      if (lastObj.$.type === 'married') {
        if (lastObj._) {
          lastStr.add(lastObj._)
        }
      } else {
        console.log('unknown last name type: ' + lastObj.$.type)
      }
    } else {
      lastStr.add(lastObj)
    }
  }
  return lastStr.string();
} // If name is not type="married" and there is an array then nonmarried names are in parenthesis.

// https://groups.google.com/g/ss-l/c/Mgx-4Ko_OH8
// John Cardinal
// Jan 30, 2022, 11:22:30 PM
// to ss...@googlegroups.com
// Neil,
// IF you leave some important properties in the Pages.Page Sizes section at their default values, 
// people's URLs will not change when you update your TMG data or change who is included in the site.
// 1 – Leave People per Page at the default value, which is 30. This isn't necessary for static URLs, 
//     but it's a good idea You can use a slightly lower number if you want, say 25. 
//     Also, set the One Person Script to checked, the default.
// 2 – Leave Person Page Sequence set to "By TMG ID"
// 3 – Leave the Static Page Assignments checkbox checked.
// 4 – Leave the Use Person Page Groups checkbox checked.
// Once you set these values and then publish your site, don't change them. For example, don't change 
// People per Page to some other number. That will move people. The subsequent URLs will be static 
// (they won't change based adding or removing people), but they won't be the same as they were.
// The default settings are not an accident. They were chosen for several reasons, one of which is 
// to produce static URLs.
// John Cardinal

function personText(oneNode) {
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

function peopleList(itemNode) {
  var people = new AppendString(', ');
  var personNodes = itemNode.person;

  if (Array.isArray(personNodes)) {
    var personLen = personNodes.length;
    for (var i = 0; i < personLen; i++) {
      people.add( personText(personNodes[i]) )
    }
  } else {
    people.add( personText(personNodes) )
  }
  return people.string()
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

export function showNodeDescription(itemObject) {
  var sourceText = new AppendString(', ')
  var receivedText = new AppendString(', ')
  if (Array.isArray(itemObject.source)) {
    var len = itemObject.source.length;
    for (var i = 0; i < len; i++) {
      var itemSource = itemObject.source[i];
      if (itemSource) {
        sourceText.add( personText(itemSource.person) )
        receivedText.add( dateText(itemSource.received) )
      }
    }
  } else {
    sourceText.add( personText(itemObject.source.person) )
    receivedText.add( dateText(itemObject.source.received) )
  }

  let dataObject = {
    peopleDisplay: peopleList(itemObject),
    dateDisplay: dateText(itemObject.date),
    locationDisplay: itemObject.location ? locationText(itemObject.location) : '',
    sourceDisplay: sourceText.string(),
    receivedDisplay: receivedText.string(),
    version: version,
    ssURL: url.pathToFileURL( path.resolve( path.dirname( nconf.get('db:accessionsPath') ), 'website', 'index.htm' ) ).href,
    ...itemObject
  }
  return detailCompiled(dataObject)
} // showNodeDescription