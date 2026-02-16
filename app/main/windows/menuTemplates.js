/**
 * Menu templates for the Shoebox application
 * Separates menu configuration from main process logic
 */

import { Menu } from 'electron';

/**
 * Create the main application menu
 * @param {Object} options - Menu configuration options
 * @param {boolean} options.showCollection - Whether to show export collection option
 * @param {Function} options.chooseAccessionsPath - Handler for choosing accessions file
 * @param {Function} options.buildCollection - Handler for exporting collection
 * @param {Function} options.createCreateAccessionsWindow - Handler for create accessions window
 * @param {Function} options.createUpdateCollectionWindow - Handler for update collection window
 * @param {Function} options.createPersonManagerWindow - Handler for person manager window
 * @param {Function} options.createCollectionManagerWindow - Handler for collection manager window
 * @param {Function} options.createTreeWindow - Handler for family tree window
 * @param {Function} options.validateDatabase - Handler for archive validation
 * @param {Function} options.validateCollection - Handler for collection validation
 * @param {Function} options.showAbout - Handler for About dialog
 * @param {Function} options.backupArchive - Handler for backing up archive
 * @param {Function} options.backupAllCollections - Handler for backing up all collections
 * @param {Function} options.createMaintenanceCollections - Handler for creating maintenance collections
 * @param {Function} options.updateCollectionMetadata - Handler for editing collection metadata
 * @param {Function} options.addItemsFromCollection - Handler for adding items from another collection
 * @param {Function} options.removeItemsFromCollection - Handler for removing items in another collection
 * @param {Function} options.intersectWithCollection - Handler for intersecting with another collection
 * @param {Function} options.addAllItemsToCollection - Handler for adding all archive items
 * @param {Function} options.createBulkEditItemsWindow - Handler for bulk editing items in collection
 * @param {Function} options.editMediaFromMenu - Handler for editing media from menu
 * @returns {Menu} Electron Menu instance
 */
export function createMainMenu(options) {
  const {
    showCollection,
    chooseAccessionsPath,
    buildCollection,
    createCreateAccessionsWindow,
    createUpdateCollectionWindow,
    createPersonManagerWindow,
    createCollectionManagerWindow,
    createTreeWindow,
    validateDatabase,
    validateCollection,
    showAbout,
    backupArchive,
    backupAllCollections,
    createMaintenanceCollections,
    updateCollectionMetadata,
    addItemsFromCollection,
    removeItemsFromCollection,
    intersectWithCollection,
    addAllItemsToCollection,
    createBulkEditItemsWindow,
    editMediaFromMenu
  } = options;

  const template = [
    {
      label: '&File',
      submenu: [
        {
          label: 'Choose &Accessions.json file',
          click: chooseAccessionsPath
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'A&rchive',
      submenu: [
        {
          label: '&Add Media Metadata',
          click: createCreateAccessionsWindow
        },
        {
          label: '&Validate',
          click: validateDatabase
        },
        { type: 'separator' },
        {
          label: '&Backup Archive',
          click: backupArchive
        },
        { type: 'separator' },
        {
          label: '&Person Manager',
          click: createPersonManagerWindow
        },
        { type: 'separator' },
        {
          label: '&Edit Media',
          click: editMediaFromMenu
        }
      ]
    },
    {
      label: '&Collections',
      submenu: [
        {
          label: '&Create Collection',
          click: () => createCollectionManagerWindow('create')
        },
        {
          label: '&Update Collection',
          click: updateCollectionMetadata
        },
        {
          label: '&Delete Collection',
          click: () => createCollectionManagerWindow('delete')
        },
        {
          label: 'Va&lidate Collection',
          click: validateCollection
        },
        { type: 'separator' },
        {
          label: '&Backup All Collections',
          click: backupAllCollections
        },
        {
          label: 'Create &Maintenance Collections',
          click: createMaintenanceCollections
        },
        { type: 'separator' },
        (showCollection ? {
          label: '&Add Items from Collection...',
          click: addItemsFromCollection
        } : null),
        (showCollection ? {
          label: '&Remove Items (in Collection)...',
          click: removeItemsFromCollection
        } : null),
        (showCollection ? {
          label: '&Intersect with Collection...',
          click: intersectWithCollection
        } : null),
        (showCollection ? {
          label: 'Add A&ll Archive Items',
          click: addAllItemsToCollection
        } : null),
        (showCollection ? { type: 'separator' } : null),
        (showCollection ? {
          label: 'Bul&k Edit Items in Collection',
          click: createBulkEditItemsWindow
        } : null),
        (showCollection ? {
          label: 'E&xport Collection',
          click: buildCollection
        } : null)
      ].filter(item => item !== null)
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'Family &Tree',
          click: createTreeWindow
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: '&Documentation',
          accelerator: 'F1',
          click: () => {
            // Open documentation website in default browser
            import('electron').then(({ shell }) => {
              shell.openExternal('https://marvbudd.github.io/shoebox/');
            });
          }
        },
        {
          label: '&Keyboard Shortcuts',
          click: () => {
            // Open keyboard shortcuts guide in default browser
            import('electron').then(({ shell }) => {
              shell.openExternal('https://marvbudd.github.io/shoebox/guide/keyboard-shortcuts.html');
            });
          }
        },
        { type: 'separator' },
        {
          label: 'About Shoebox',
          click: showAbout
        }
      ]
    }
  ];
  
  return Menu.buildFromTemplate(template);
}

/**
 * Create minimal menu for child windows
 * @param {Object} options - Menu configuration options
 * @param {Function} options.createTreeWindow - Handler for family tree window
 * @returns {Menu} Electron Menu instance
 */
export function createMinimalMenu(options) {
  const { createTreeWindow } = options;
  
  const template = [
    {
      label: '&File',
      submenu: [
        { role: 'close' }
      ]
    },
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'Family &Tree',
          click: createTreeWindow
        }
      ]
    }
  ];
  
  return Menu.buildFromTemplate(template);
}
