
# MEditor Reference

## Example

```html
<html>
<body>
    <div id="main"></div>


    <script src="path/to/MEditor/MEditor.js"></script>
    <script>
        async function main(){
            const editor = new MEditor();
            await editor.editor("main");

            const explorer = editor.createExplorer(editor.page.main.left);

            files = {
            "name": "/",
            "type": "dir",
            "files": [
                {
                    "name": "file1.txt",
                    "type": "text",
                }
            ]

            explorer.loadExplorer(files);
        }

        main();
    </script>
</body>
</html>

```

## Objects

### MEditor

#### async editor (containerId)

Method of initialize MEditor.
This method is async function.

##### args

- containerId: Id of HTML element you want to set to container of MEditor.

#### adjustEditor ()

Method of adjust editor layout.
Run this method when you want to adjust the layout of the editor.

##### args

N/A








