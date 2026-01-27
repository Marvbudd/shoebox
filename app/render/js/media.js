const $previewDiv = document.getElementById("previewDiv");
const $prevDataDiv = document.getElementById("prevDataDiv")

let a = 0
$prevDataDiv.addEventListener('dblclick', (e) => {
  var detailElements = document.getElementsByClassName('detail')
  for (var i = 0; i < detailElements.length; i++) {
    if (a == 0) {
      detailElements[i].style.display = 'table-row'
    } else {
      detailElements[i].style.display = 'none'
    }
  }
  a = a == 0 ? 1 : 0
}) // $prevDataDiv

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
      TACO.sendToMain(TACO.req.ITEMPLAY, JSON.stringify(entry))
    }
  }
} // playEntry

function setPlaylistListener() {
  // mouseover on playlist entries
  const tdElements = $prevDataDiv.getElementsByClassName('playEntry')
  if (tdElements.length > 0) {
    for (var i = 0; i < tdElements.length; i++) {
      tdElements[i].addEventListener('mouseover', playEntry);
    }
  }
} // setPlaylistListener

function mediaContent(itemString) {
  const itemObject = JSON.parse(itemString)
  $prevDataDiv.innerHTML = itemObject.descDetail
  $previewDiv.innerHTML = itemObject.mediaTag
  document.title = itemObject.link
  if (itemObject.entry) {
    var $mediaObject = $previewDiv.querySelector('#previewAudio')
    if (!$mediaObject) {
      $mediaObject = $previewDiv.querySelector('#previewVideo')
    }
    if ($mediaObject) {
      $mediaObject.currentTime = itemObject.entry.startSeconds
      $mediaObject.play()
      setTimeout(() => {
        $mediaObject.pause()
      }, itemObject.entry.durationSeconds * 1000);
    }
  }
  a = 0
  const $editMedia = document.getElementById("editMedia")
  $editMedia.addEventListener('click', (e) => {
    const keyData = { link: document.getElementById('link').innerText }
    TACO.sendToMain(TACO.req.ITEMEDIT, JSON.stringify({keyData}))
  })
  const $openWebsite = document.getElementById("openWebsite")
  $openWebsite.addEventListener('click', (e) => {
    TACO.sendToMain(TACO.req.OPENWEBSITE)
  })
  setPlaylistListener()
} //
TACO.onMediaDisplay(mediaContent)