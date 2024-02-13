This is a project that displays multimedia files with descriptive information about each file.

As I was collecting photos, videos of interviews with older living relatives, and recordings of interviews and visits to historic sites with significant relevance to my family history I put them in a big "shoebox" until I could curate them for others to use. It was difficult to share these rare items with others who wanted them, and the information I collected about them was almost as valuable as the items. 

This project is my answer to the need to make this information available. The original was started during the 9/11 era when I was off work for a year. It was written for Windows 98 and Internet Explorer. Javascript was cool, and not needing to install additional software made this attractive. Unfortunately, this choice made the result inaccessible to Apple and *nix users, and as browser technology became more secure it did not run at all.

With this software, written in Electron/Node.js, I include a subset of the media for my family that is customized to the part of the family they share with me. Then I add my pedigree and genealogy research using a product called Second Site by John Cardinal. This is written to a data DVD, or a shared drive for them to install on their computer. 

To Install: First look for the installer appropriate for your operating system. x.x.x is the shoebox version.
  Apple Mac  - shoebox-x.x.x.AppImage
  Windows 10 - shoebox Setup x.x.x.exe
  Linux      - shoebox-x.x.x.dmg

After the install completes the software can be run and only a sample set of files is installed. You can then either copy the files to an empty directory on your computer, or direct shoebox to open the accessions.json file directly. To select the location press <ALT>F for Windows/Linux or <CMD>F for Mac to access the menu. Then select "Choose Accessions.json file" from the menu. Use the dialog to find and double click on the accessions.xml file on your computer or on the DVD as needed. Now the full set of media can be viewed. The last selection is retained for future use by shoebox.

The github.com:Marvbudd/shoebox.git is the current project repository. Please email me with your needs and ideas. I'm looking for collaborators.

As I release version 2.0.0 which abandons xml in favor of json I have a small node.js app that I'll email anyone who asks. It converts accessions.xml to accessions.json.

Some improvements I'm hoping for:
  1. Ability to click on a name in shoebox and a link opens to the Second Site entry for that person. Requires entering the TMG ID for each person in accessions.json and code changes. Second Site already supports this.
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
  2. Remove the categories property from accessios.json and have a set of category/list.json files instead. Support ad hoc list.json creation within shoebox.
  3. An app to ingest select media directories and build an accessions.json file automatically for them, looking for internal metadata. This would be better than hand coding accessions.json. Then an entry editor form would be nice to complete each entry.
  4. Each person's face in a picture should be identified like social media tags. Automatic facial recognition??

Marvin E Budd
marvbudd@gmail.com
