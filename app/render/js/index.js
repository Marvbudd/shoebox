// Elements
const $tableDiv = document.querySelector('#tableDiv')
const $selectSort = document.querySelector('#selectSort')
const $selectCollectionLabel = document.querySelector('#selectCollectionLabel')
const $selectCollection = document.querySelector('#selectCollection')

const $navHeader = document.querySelector('#navHeader')
const $previewDiv = document.querySelector('#previewDiv')
const $prevDataDiv = document.getElementById('prevDataDiv')

const $photo = document.getElementById('photo')
const $tape = document.getElementById('tape')
const $video = document.getElementById('video')
const $restrictLabel = document.getElementById('restrictLabel')
const $restrict = document.getElementById('restrict')

//  selectDiv     detailDiv
// +----------+---------------------+
// |          |                     |
// |          |                     |
// | tableDiv |    previewDiv       |
// |          |                     |
// |          |                     |
// |          |                     |
// +          +---------------------+
// |          |                     |
// +----------+    prevDataDiv      |
// |$playerObj|    prevData(table)  |
// |$tableSort|                     |
// +----------+---------------------+

let a = 0
$prevDataDiv.addEventListener('dblclick', (e) => {
  var detailElements = document.getElementsByClassName('detail')
  for (var i = 0; i < detailElements.length; i++) {
    if (a == 0) {
      detailElements[i].hidden = false
    } else {
      detailElements[i].hidden = true
    }
  }
  a = a == 0 ? 1 : 0
}) // prevDataDiv

function playEntry (windowEvent) {
  var rowElement = windowEvent.currentTarget.closest('tr')
  if (rowElement) {
    const entry = {
      ref: rowElement.querySelector('#playlink').innerText,
      start: rowElement.querySelector('#playstart').innerText,
      duration: rowElement.querySelector('#playduration').innerText,
    }
    BURRITO.sendToMain(BURRITO.req.ITEMPLAY, JSON.stringify(entry))
  }
} // playEntry

function setPlaylistListener() {
  // mouseover on playlist entries
  const tdElements = $prevDataDiv.getElementsByClassName('playEntry')
  if (tdElements.length > 0) {
    for (var i = 0; i < tdElements.length; i++) {
      tdElements[i].addEventListener('mouseover', playEntry)
    }
  }
} // setPlaylistListener

function mediaContent(itemString) {
  if (itemString) {
    let itemObject = JSON.parse(itemString)
    $prevDataDiv.innerHTML = itemObject.descDetail
    $previewDiv.innerHTML = itemObject.mediaTag  
    a = 0
    // editMedia doesn't exist until the items are rendered
    const $editMedia = document.getElementById("editMedia")
    $editMedia.addEventListener('click', (e) => {
      const keyData = { accession: document.getElementById('accession').innerText }
      BURRITO.sendToMain(BURRITO.req.ITEMEDIT, JSON.stringify({keyData}))
    })
    setPlaylistListener()
  }
} // mediaContent
BURRITO.whenItemDetail(mediaContent)

$photo.addEventListener('change', controlsChanged)
$tape.addEventListener('change', controlsChanged)
$video.addEventListener('change', controlsChanged)
$restrict.addEventListener('change', controlsChanged)
$selectCollection.addEventListener('change', controlsChanged)
function controlsChanged() {
  hideHighlightFilter()
  let controls = {}
  controls.photoChecked = $photo.checked
  controls.tapeChecked = $tape.checked
  controls.videoChecked = $video.checked
  if ($selectCollectionLabel.hidden) {
    controls.restrictChecked = false
    controls.selectedCollection = ''
  } else {
    controls.restrictChecked = $restrict.checked
    controls.selectedCollection = $selectCollection.value
  }
  try {
    BURRITO.sendToMain(BURRITO.req.ITEMSCOLLECTION, JSON.stringify(controls))
  } 
  catch (error) {
    console.log('Error in controlsChanged: ', error)
  }
} // controlsChanged

// The left column text is green if the item is in the selected collection
// The left column text is black if the item is not in the selected collection
// Items are hidden if their media type is not selected
//  or if the restrict checkbox is checked and the item is not in the selected collection
function hideHighlightFilter() {
  let selectedCollection = '';
  let restrict = false;
  if (!$selectCollectionLabel.hidden) {
    selectedCollection = $selectCollection.value;
    restrict = $restrict.checked;
  }
  const showClassArray = [
    { class: "photo", show: $photo.checked === true },
    { class: "tape", show: $tape.checked === true },
    { class: "video", show: $video.checked === true }
  ];

  let detailElements = $tableDiv.getElementsByTagName('tr');
  for (let i = 0; i < detailElements.length; i++) {
    const detailElementClass = detailElements[i].attributes.class.value;
    const showClass = showClassArray.find(showClass => showClass.class === detailElementClass)?.show;
    if (selectedCollection && detailElements[i].attributes.collections) {
      const collections = detailElements[i].attributes.collections.value.split(',');
      // Compare the entire string with selectedCollection
      if (collections.some(collection => collection === selectedCollection)) {
        detailElements[i].firstChild.style.color = 'green';
        detailElements[i].hidden = !showClass;
      } else {
        detailElements[i].firstChild.style.color = '';
        detailElements[i].hidden = restrict || !showClass;
      }
    } else {
      detailElements[i].hidden = !showClass;
    }
  }
} // hideHighlightFilter

// Toggle item in the selected collection on double click
// A forced reload of the items list is done to update the collection column
function collectionSelect(windowEvent) {
  // Find nearest parent that is a tr element
  var rowElement = windowEvent.currentTarget.closest('tr')
  if (rowElement) {
    // Find first child and then it's first child innerText which is the hidden value
    try {
      var accession = rowElement.attributes.accession.nodeValue
      BURRITO.sendToMain(BURRITO.req.ITEMSETCOLLECTION, accession)
    }
    catch (error) {
      alert('Error modifying the collection in collectionSelect: ' + error)
    }
    getItemsList()
  }
} // collectionSelect

function showThumb(windowEvent) {
  // Find nearest parent that is a tr element
  var rowElement = windowEvent.currentTarget.closest('tr')
  if (rowElement) {
    // Find first child and then it's first child innerText which is the hidden value
    try {
      var accession = rowElement.attributes.accession.nodeValue
      BURRITO.sendToMain(BURRITO.req.ITEMGETDETAIL, accession)
    }
    catch (error) {
      console.log('Error in showThumb: ', error)
    }
  }
} // showThumb

window.addEventListener('DOMContentLoaded', getItemsList)
$selectSort.addEventListener('change', () => {
  getItemsList()
}) // selectSort

function getItemsList() {
  let requestParams = {
    sort: $selectSort.value
  }
  BURRITO.sendToMain(BURRITO.req.ITEMSGETLIST, requestParams)
} // getItemsList

function renderItems(tableString) {
  const listObject = JSON.parse(tableString)
  document.title = listObject.accessionTitle
  // debugger;
  $photo.checked = listObject.photoChecked
  $tape.checked = listObject.tapeChecked
  $video.checked = listObject.videoChecked
  $restrict.checked = listObject.restrictChecked
  // If there are no collections, hide the selectCollectionLabel and selectCollection from the sort options
  if (listObject.collections.length === 0) {
    $selectCollectionLabel.hidden = true
    $restrictLabel.hidden = true
  } else {
    // remove all options from selectCollection before adding new ones
    while ($selectCollection.options.length > 0) {
      $selectCollection.remove(0);
    }

    listObject.collections.forEach(collection => {
      const option = document.createElement('option')
      option.value = collection.value
      option.text = collection.text
      if (listObject.selectedCollection === collection.value) {
        option.selected = true
      }
      $selectCollection.appendChild(option)
    })
  }
  $navHeader.innerHTML = listObject.navHeader
  $tableDiv.innerHTML = listObject.tableBody
  const tdElements = $tableDiv.getElementsByTagName('td')
  if (tdElements.length > 0) {
    for (var i = 0; i < tdElements.length; i++) {
      var tde = tdElements[i].childNodes[0]
      if (tde && tde.nodeName === "DIV") {
        tde.addEventListener('mouseover', showThumb)
        tde.addEventListener('dblclick', collectionSelect) // Add event listener for dblclick
      }
    }
  }
  hideHighlightFilter()
} // renderItems
BURRITO.whenItemsRender(renderItems)