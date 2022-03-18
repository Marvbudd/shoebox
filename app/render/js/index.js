// Elements
const $tableDiv = document.querySelector('#tableDiv')
const $selectSort = document.querySelector('#selectSort')
const $selectCategoryLabel = document.querySelector('#selectCategoryLabel')
const $selectCategory = document.querySelector('#selectCategory')

const $previewDiv = document.querySelector('#previewDiv')
const $prevDataDiv = document.getElementById("prevDataDiv")

const $photo = document.getElementById('photo')
const $tape = document.getElementById('tape')
const $video = document.getElementById('video')

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
})

$photo.addEventListener('change', mediaTypeChange)
$tape.addEventListener('change', mediaTypeChange)
$video.addEventListener('change', mediaTypeChange)
function mediaTypeChange() {
  // We call this for unchecked boxes after selectionChanged
  let element = this
  let detailElements = document.getElementsByClassName(element.name)
  const showClass = element.checked === true
  for (var i = 0; i < detailElements.length; i++) {
    if (showClass) {
      detailElements[i].hidden = false
    } else {
      detailElements[i].hidden = true
    }
  }
}

function playEntry () {
  const windowEvent = window.event
  if (windowEvent) {
    var rowElement = windowEvent.currentTarget.closest('tr')
    if (rowElement) {
      const entry = {
        ref: rowElement.querySelector('#playlink').innerText,
        start: rowElement.querySelector('#playstart').innerText,
        duration: rowElement.querySelector('#playduration').innerText,
      }
      BURRITO.sendToMain(BURRITO.req.ITEMPLAY, JSON.stringify(entry))
    }
  }
}

function setPlaylistListener() {
  // mouseover on playlist entries
  const tdElements = $prevDataDiv.getElementsByClassName('playEntry')
  if (tdElements.length > 0) {
    for (var i = 0; i < tdElements.length; i++) {
      tdElements[i].setAttribute('onmouseover', 'playEntry()')
    }
  }
}

function mediaContent(itemString) {
  if (itemString) {
    let itemObject = JSON.parse(itemString)
    $prevDataDiv.innerHTML = itemObject.descDetail
    $previewDiv.innerHTML = itemObject.mediaTag  
    a = 0
    setPlaylistListener()
  }
}
BURRITO.whenItemDetail(mediaContent)

$selectCategory.addEventListener('change', highlightCategory)
function highlightCategory() {
  if (!$selectCategoryLabel.hidden) {
    const selectedCategory = $selectCategory.value
    let detailElements = $tableDiv.getElementsByTagName('tr')
    for (i = 0; i < detailElements.length; i++) {
      if (detailElements[i].attributes.categories) {
        if (detailElements[i].attributes.categories.value.includes(selectedCategory)) {
          detailElements[i].firstChild.style.color = 'green'
        } else {
          detailElements[i].firstChild.style.color = ''
        }
      }
    }
    try {
      BURRITO.sendToMain(BURRITO.req.ITEMSCATEGORY, selectedCategory)
    } 
    catch (error) {
      console.log('Error in highlightCategory: ', error)
    }
  }
}

function showThumb() {
  var windowEvent = window.event
  if (windowEvent) {
    // Find nearest parent that is a tr element
    var rowElement = windowEvent.currentTarget.closest('tr')
    if (rowElement) {
      // Find first child and then it's first child innerText which is the hidden value
      try {
        var itemOrdinal = rowElement.attributes.accession.nodeValue
        // console.log('showThumb ran for this: ', itemOrdinal)
        BURRITO.sendToMain(BURRITO.req.ITEMGETDETAIL, itemOrdinal)
      }
      catch (error) {
        console.log('Error in showThumb: ', error)
      }
    }
  } else {
    console.log('showThumb window.event was null!!!')
  }
}

window.addEventListener('DOMContentLoaded', getItemsList)
$selectSort.addEventListener('change', () => {
  saveCheckbox()
  getItemsList()
})
function getItemsList() {
  let requestParams = {
    sort: $selectSort.value,
    category: $selectCategory.value
  }
  BURRITO.sendToMain(BURRITO.req.ITEMSGETLIST, requestParams)
}

window.addEventListener('beforeunload', saveCheckbox)
function saveCheckbox() {
  let itemsObject = {}
  itemsObject.photoChecked = $photo.checked
  itemsObject.tapeChecked = $tape.checked
  itemsObject.videoChecked = $video.checked
  BURRITO.sendToMain( BURRITO.req.ITEMSRELOAD, JSON.stringify(itemsObject) )
}

function renderItems(tableString) {
  const listObject = JSON.parse(tableString)
  $photo.checked = listObject.photoChecked
  $tape.checked = listObject.tapeChecked
  $video.checked = listObject.videoChecked
  $selectCategoryLabel.hidden = !listObject.categoryDisplay
  $selectSort.options[6].hidden = !listObject.categoryDisplay
  $tableDiv.innerHTML = listObject.tableBody
  const tdElements = $tableDiv.getElementsByTagName('td')
  if (tdElements.length > 0) {
    for (var i = 0; i < tdElements.length; i++) {
      var tde = tdElements[i].childNodes[0]
      if (tde && tde.nodeName === "DIV") {
        tde.setAttribute('onmouseover', 'showThumb()')
      }
    }
  }
  if (!$photo.checked === true) {
    $photo.dispatchEvent(new CustomEvent("change"))
  }
  if (!$tape.checked === true) {
    $tape.dispatchEvent(new CustomEvent("change"))
  }
  if (!$video.checked === true) {
    $video.dispatchEvent(new CustomEvent("change"))
  }
  // highlight selected category entries
  highlightCategory()
}
BURRITO.whenItemsRender(renderItems)