const $key = document.getElementById('key');
const $title = document.getElementById('title');
const $text = document.getElementById('text');
const $addCollectionModal = document.getElementById('addCollectionModal');
const $deleteCollectionModal = document.getElementById('deleteCollectionModal');
const $addCollectionForm = document.getElementById('addCollectionForm');
const $deleteCollectionForm = document.getElementById('deleteCollectionForm');
const $collection = document.getElementById('collection');

$addCollectionForm.addEventListener('submit', (event) => {
  let formData = new FormData($addCollectionForm);
  let formJSON = Object.fromEntries(formData);
  AREPAS.sendToMain(AREPAS.req.ADDCOLL, JSON.stringify(formJSON));
});
$deleteCollectionForm.addEventListener('submit', (event) => {
  let formData = new FormData($deleteCollectionForm);
  let formJSON = Object.fromEntries(formData);
  AREPAS.sendToMain(AREPAS.req.DELETECOLL, JSON.stringify(formJSON));
});
window.addEventListener('DOMContentLoaded', getCollection)
function getCollection() {
  AREPAS.sendToMain(AREPAS.req.GETCOLLECTION);
}

AREPAS.onAddMediaShowCollections((data) => {
  let response = JSON.parse(data);
  if (response.collectionlist) {
    document.title = 'Delete Collection';
    $deleteCollectionForm.reset();
    $addCollectionModal.style.display = 'none';
    $deleteCollectionModal.style.display = 'block';
    $collection.innerHTML = '';
    response.collectionlist.forEach(item => {
      let option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.text;
      $collection.appendChild(option);
    });
  } else {
    document.title = 'Create Collection'
    $addCollectionForm.reset();
    $addCollectionModal.style.display = 'block';
    $deleteCollectionModal.style.display = 'none';
  }
});
