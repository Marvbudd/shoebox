import { xsltProcess, xmlParse } from 'xslt-processor'
const xml2js = require('xml2js')
const fs = require('fs')

// Enable ES6 https://nodejs.org/docs/latest-v13.x/api/esm.html#esm_enabling
// ES6 summary https://hackernoon.com/import-export-default-require-commandjs-javascript-nodejs-es6-vs-cheatsheet-different-tutorial-example-5a321738b50f
// position() instead of count https://www.educba.com/xslt-count/?source=leftnav

// https://www.npmjs.com/package/xslt-processor
// https://npm.runkit.com/xslt-processor

// xml2js https://openbase.com/js/xml2js

export class AccessionClass {
  constructor(accessionFilename) {
    this.accessionFilename = accessionFilename
    this.accessionXML = fs.readFileSync(this.accessionFilename).toString()
    const parser = new xml2js.Parser({ explicitArray: false })
    parser.parseString(this.accessionXML, (err, results) => {
      this.accessionJSON = results.accessions
    })
    this.replaceAll = (str, mapObj) => {
      let mappedString = str
      mapObj.forEach( ( value, key ) => {
        mappedString = mappedString.replace( key, value )
      })
      return mappedString
    }
  }
  transform(xslPath, mapObj) {
    // replaceAll substitutes for parameters in xsl
    let xslData = this.replaceAll(
      fs.readFileSync(xslPath).toString(),
      mapObj )
    try {
      const outXmlString = xsltProcess(
        xmlParse(this.accessionXML),
        xmlParse(xslData)
      );
      return outXmlString
    }
    catch (error) {
      console.log('Error in AccessionClass.transform. ', error)
    }
  }
  getJSONItem(itemNumber, callback) {
    let oneItem
    let items = this.accessionJSON.item.filter(item => {
      return item.accession === itemNumber
    })
    if (items.length > 1) {
      console.log('getJSONItem: ' + items.length + ' items for accession: ' + itemNumber)
    }
    callback(items[0])
  }
  getJSONForLink(link, callback) {
    let oneItem
    let items = this.accessionJSON.item.filter(item => {
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
    if (this.accessionJSON.item) {
      this.accessionJSON.item.forEach(item => {
        // playlist can be an array if > 1
        if (item.playlist) {
          if (Array.isArray(item.playlist.entry)) {
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
          } else {
            let entry = item.playlist.entry
            if (entry.ref === link) {
              refs.push({
                entry: {
                  ref: item.link,
                  starttime: entry.starttime,
                  duration: entry.duration
                }
              })
            }
          }
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