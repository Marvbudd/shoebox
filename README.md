This is a project that displays multimedia files with descriptive information about each file.

As I was collecting photos, videos of interviews with older living relatives, and recordings of interviews and visits to historic sites with significant relevance to my family history I put them in a big "shoebox" until I could curate them for others to use. It was difficult to share these items with others who wanted them along with my discoveries about them.

This project is my answer to the need to make this information available without paying a subscription fee. I started this in 9/11 era when I was off work for a year. It was written for Windows 98 and Internet Explorer. Shoebox, written in Electron/Node.js, is the current software. Then I add my pedigree and genealogy research using a product called Second Site by John Cardinal (https://www.secondsite8.com/). This is written to a data DVD, or a shared drive for others to install on their computer. 

To install, go to https://github.com/Marvbudd/shoebox and look on the right side for the Latest release and click. Under the assets select the installer appropriate for your operating system as listed below where x.x.x is the shoebox version.<br>
  Apple Mac  - shoebox-x.x.x.dmg<br>
  Windows 10 - shoebox-Setup-x.x.x.exe<br>
  Linux      - shoebox-x.x.x.AppImage<br>

For Windows or Linux just double click on the downloaded file to install shoebox. For Apple Mac, you need to run the .dmg file, then drag it to the Applications folder and then run it. Here is a YouTube video showing the process with a different app. Do that same thing with the shoebox-x.x.x.dmg file.

After the install completes only a sample set of files is installed. For my family I provide a link to the data in a .zip file. Email me for this file if you would like it. Download the file to a clean directory on your computer. Then extract the files there.

Now run shoebox and direct it to the directory where you extracted the files. To do this hold down the ALT key and press F for Windows/Linux or CMD-F for Mac to access the menu. Then select "Choose Accessions.json file" from the File menu. Use the dialog to find and double click on the accessions.json file on your computer or on the DVD as needed. Now the full set of media can be viewed. The last selection is retained for future use by shoebox.

As you run shoebox you will have a separate window for photos, and another for audio/video. Resize and move these so you can see them at the same time on your system. Multiple monitors are useful, but one screen can be used too.

Here is the directory structure for the accessions.json file and the media that I provide in the .zip file.

accessions.json<br>
./photo <-- jpg files here<br>
./video <-- mp4 files here<br>
./audio <-- mp3 files here<br>
./collections <-- optional - key.json files for lists<br>
./website/index.htm <-- Second Site<br>

Collections allow you to create arbitrary subsets of the media. To create a Collection, use any editor to save the following in the ./collections subdirectory. Name it something like mycoll.json (keep it short with no spaces) and edit the text and title as desired to identify your collection. After this, open shoebox and use the dropdown and Filter controls. Toggle whether an item is in the collection by double clicking on the left hand column. Green text means it is in the selected collection. ALT-F opens a menu to write the collection to a subdirectory.<br>
{<br>
  "itemKeys": [ ],<br>
  "text": "Short description",<br>
  "title": "A New Collection - appears in the title bar of the collection page"<br>
}<br>

I have uploaded some very basic videos on installing and using shoebox. See this link to the playlist: https://www.youtube.com/playlist?list=PL8z7p1h74xBqbjDLCWjncm9EF5RL7oTDP

As I release version 2.0.0, which abandons xml in favor of json, I have a small node.js app that converts accessions.xml to accessions.json.

Some improvements I'm hoping for:
  1. Ability to click on a name in shoebox and a link opens to the Second Site entry for that person. Requires entering the TMG ID for each person in accessions.json and code changes. Second Site already supports this.
        // https://groups.google.com/g/ss-l/c/Mgx-4Ko_OH8<br>
        // John Cardinal<br>
        // Jan 30, 2022, 11:22:30 PM<br>
        // to ss...@googlegroups.com<br>
        // Neil,<br>
        // IF you leave some important properties in the Pages.Page Sizes section at their default values, <br>
        // people's URLs will not change when you update your TMG data or change who is included in the site.<br>
        // 1 – Leave People per Page at the default value, which is 30. This isn't necessary for static URLs, <br>
        //     but it's a good idea You can use a slightly lower number if you want, say 25. <br>
        //     Also, set the One Person Script to checked, the default.<br>
        // 2 – Leave Person Page Sequence set to "By TMG ID"<br>
        // 3 – Leave the Static Page Assignments checkbox checked.<br>
        // 4 – Leave the Use Person Page Groups checkbox checked.<br>
        // Once you set these values and then publish your site, don't change them. For example, don't change <br>
        // People per Page to some other number. That will move people. The subsequent URLs will be static <br>
        // (they won't change based adding or removing people), but they won't be the same as they were.<br>
        // The default settings are not an accident. They were chosen for several reasons, one of which is <br>
        // to produce static URLs.<br>
        // John Cardinal<br>
  2. Improve the metadata editing to encompass all possibilities. Current version if crude and error-prone.
  3. Each person's face in a picture should be identified like social media tags. Maybe we can process the photo and store a list of rectangles to identify. See https://www.sitepoint.com/face-detection-nodejs-opencv/ and others.

Marvin E Budd
marvbudd@gmail.com
