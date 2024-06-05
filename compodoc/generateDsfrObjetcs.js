const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const jsoncParser = require('jsonc-parser');

function getInterfaceDefinition(compodocInterface) {
    const regexInterface = RegExp('export interface\\s\\w+\\s(extends\\s\\w+\\s)?\\{[^\\}]*\\}', 'msg');
    try {
        let relpath = ("../" + compodocInterface.file).replaceAll("/","\\");
        let tsFilePath = path.resolve(__dirname, relpath);
        const tsContent = fs.readFileSync(tsFilePath, 'utf8');

        let arr;
        while ((arr = regexInterface.exec(tsContent)) !== null) {
            //console.log(`Found ${arr[0]}. Next starts at ${regexInterface.lastIndex}.`);
            let text = arr[0];
            let begin = "export interface "+ compodocInterface.name + " ";
            if (text.startsWith(begin)) {
                //return text.substring(text.indexOf("{"));
                return text;
            }
          }        
    } catch (e) {
        console.log(e)
    }
    return undefined;
}

function getDocumentation(compodocComponent) {
    const label = ""+ getLabel(compodocComponent);
    let firstline = getTag(compodocComponent) + "|Definit un composant <i>"+ compodocComponent.name +"</i>.<br/>";
    let descriptions = [firstline];
    try {
        let relpath = ("../" + compodocComponent.file.replace(".component.ts",".mdx")).replaceAll("/","\\");
        let mdxFilePath = path.resolve(__dirname, relpath);
        const mdxContent = fs.readFileSync(mdxFilePath, 'utf8');

        let etat = 0;
        let last = "";
        let text = mdxContent.substring(0);
        let lines = text.split("\n").filter((line) => {
            if (line.startsWith("#")) {
                if (etat < 1) {
                    etat = 1;
                    last = line;
                } else {
                    etat = 2;
                }
            }
            let ok = etat == 1;
            if (ok && last.length == 0 && line.length == 0) ok = false;
            if (ok && line.startsWith("import ")) ok = false;
            if (ok && line.startsWith("<")) ok = false;
            if (ok) {
                last = line;
            }
            return ok;
        });
        return descriptions.concat(lines.map((line) => {
            let l = line;
            l = l.replace(/\<([^<>]+)\/*\>/gi, "&lt;$1&gt;");
            l = l.replace(/\[([^_]+)\]\(([^_]+)\)/gi, "$1: <a href=\"$2\">"+label+"</a>");
            l = l.replace(/_([^_]+)_/gi, "<i>$1</i>");
            l = l.replace(/`([^`]+)`/gi, "<code>$1</code>");
            l = l.replace(/\*\*([^\*]+)\*\*/gi, "<b>$1</b>");
            return l + "<br/>"
        }));
    } catch (e) {
        console.log("Mdx error: " + e)
        return descriptions
            .concat([
                "<br/>Pas de documentation supplémentaire.",
                "<br/>Voir Système de Design de l'État: <a href=\"https://www.systeme-de-design.gouv.fr/elements-d-interface/composants/\">Composants</a>"
            ]);
    }
}

function getPlainValue(value) {
    if (value) {
        let plainValue = "" + value;
        let len = plainValue.length;
        if (plainValue.startsWith("'") && plainValue.endsWith("'")) {
            plainValue = plainValue.substring(1, len - 1);
        } else if (plainValue.startsWith("\"") && plainValue.endsWith("\"")) {
            plainValue = plainValue.substring(1, len - 1);
        } else if (plainValue.startsWith("[") || plainValue.startsWith("{")) {
            plainValue = false;
        }
        return plainValue;
    } else {
        return false;
    }
}

function getDsfrTypeValues(dsfrType) {
    let dsfrTypeConst = dsfrConst[dsfrType + "Const"];
    if (dsfrTypeConst) {
        return [false].concat(Object.values(dsfrTypeConst));
    }
    return [false, true];
}

function getDsfrTypeValue(dsfrTypeValue) {
    if (dsfrTypeValue) {
        let arr = dsfrTypeValue.split(".");
        try {
            return dsfrConst[arr[0]][arr[1]];
        } catch (e) {
            return arr[1];
        }
    }
    return false;
}

function getProperty(prop) {
    const c8oTypes = ["string","boolean","array","number","object"];
    let dsfrTypes = prop.type.replaceAll("\"","'");

    let label = prop.name || '';
    let attr = '['+ prop.name +']' || '';
    let description = prop.description || '';
    let defvalue = prop.defaultValue || false;

    
    // overwrites type
    let types = (dsfrTypes || 'string').split(" | ");
    let enumeration = types.filter((key) => (key.charAt(0) == "'" || key.charAt(0) == "\""));
    let type = types[0];
    if (!c8oTypes.includes(type)) {
        let _T = types[0].replace("[]","");
        if (dsfrInterfaces[_T]) {
            type = "object";
        } else {
            type = "string";
        }
    }

    // overwrites description
    if (enumeration.length > 0) {
        description += "<pre>Type: " + type + "\n" 
            + [].concat(Object.values(enumeration)) 
            + "</pre>";
    } else {
        types.forEach((T) => {
            if (T && T != "undefined") {
                let _T = T.replace("[]","");
                if (dsfrInterfaces[_T]) {
                    //description += "<details><summary>Type: <code>" + T + "</code></summary><pre>" + dsfrInterfaces[_T] + "</pre></details><br/>";
                    description += "<p>Type: <a href=\""+ dsfrInterfaces[_T] +"\"><code>"+ T +"</code></a>"
                } else if (dsfrConst[_T + "Const"]) {
                    description += "<p>Type: <code>" + T + "</code><br><code>" + [].concat(Object.values(dsfrConst[_T + "Const"])) + "</code></p>";
                } else {
                    description += "<p>Type: <code>" + T + "</code></p>";
                }
            }
        });
    }

    // overwrites values
    let values = [false, true];
    if (type == "boolean") {
        values = ["false","true"];
    }
    if (enumeration.length > 0) {
        if (types[types.length -1] == "undefined") {
            enumeration.unshift(false)
        }
        values = enumeration.map((word) => getPlainValue(word));
    } else {
        let _T = types[0].replace("[]","");
        if (dsfrConst[_T + "Const"]) {
            values = getDsfrTypeValues(_T);
        }
    }

    // overwrites value
    let value = getPlainValue(defvalue);
    if (value) {
        if (value.startsWith("Dsfr")) {
            value = getDsfrTypeValue(value);
        } else if (value == value.toUpperCase() && value.indexOf("_") != -1) {
            value = false; // !!
        }
    }

    return {
        "attr": attr,
        "label": label,
        "description": description,
        "type": type,
        "value": value,
        "values": values
    };
}

function getTag(compodocComponent) {
    let tag = compodocComponent.selector.split(',')[0] || 'unknown';
    if (tag == "DSFR_TAB_SELECTORS") {
        tag = "dsfr-tab";
    }
    return tag;
}

function getDisplayName(compodocComponent) {
    let dsname = compodocComponent.name || 'unknown';
    if (dsname.endsWith("Component")) {
        dsname = dsname.substring(0, dsname.length - "Component".length);
    }
    return dsname;
}

function getLabel(compodocComponent) {
    let label = compodocComponent.name || 'unknown';
    label = label.replace("Component","");
    return label;
}

function getConfig(compodocComponent) {
    let config = {}, moduleName = undefined;
    const modules = compodocData.modules.filter((module)  => module.name == compodocComponent.name.replace("Component","Module"));
    if (modules && modules.length == 1) {
        moduleName = modules[0].name;
    } else if (compodocComponent.standalone) {
        moduleName = compodocComponent.name;
    }
    if (moduleName != undefined) {
        config["module_ts_imports"] = [{"from": "@edugouvfr/ngx-dsfr", "components": [moduleName]}],
        config["module_ng_imports"] = [moduleName]
    }
    return config;
}

function convertComponent(compodocComponent) {
    if (compodocComponent.type == "component" && compodocComponent.selector) {
        
        // Skip demo components and Others
        if (!compodocComponent.name.startsWith("Dsfr")) return;
        if (compodocComponent.deprecated) return;

        console.log("Generating "+ compodocComponent.name);
        return {
            "tag": getTag(compodocComponent),
            "displayName": getDisplayName(compodocComponent),
            "label": getLabel(compodocComponent),
            "category": "Design de l'état",
            "description": getDocumentation(compodocComponent),
            "group": "Design de l'état",
            "icon16": "dsfr_16x16.png",
            "icon32": "dsfr_32x32.png",
            "properties": (compodocComponent.inputsClass.filter((prop)  => prop.deprecated == false) || []).reduce((acc, prop) => {
                acc[prop.name] = getProperty(prop);
                return acc;
            }, {}),
            "events": (compodocComponent.outputsClass || []).reduce((acc, output) => {
                acc[output.name] = {"attr": "("+output.name+")", "description": output.description || ''};
                return acc;
            }, {}),
            "config": getConfig(compodocComponent),
        };
    }
}

// Read Compodoc JSON data
const giturl = "https://gitlab.mim-libre.fr/men/transverse/dsmen/ngx-dsfr-components/-/tree/1.10.3/projects/ngx-dsfr-components";
const compodocData = JSON.parse(fs.readFileSync('documentation.json', 'utf8'));
const dsfrConst = JSON.parse(fs.readFileSync('dsfr_const.json', 'utf8')); //TODO: to be generated from ts files

let dsfrInterfaces = {};
compodocData.interfaces.forEach(ob => {
    dsfrInterfaces[ob.name] = giturl + "/" + ob.file
});

let convertigoJson = {Beans: {}};
compodocData.components.forEach(comp => {
    const component = convertComponent(comp);
    if (component) {
        convertigoJson.Beans[comp.name] = component;
    }
 });

fs.writeFileSync('dsfr_objects.json', JSON.stringify(convertigoJson, null, 2), 'utf8');
console.log('Conversion completed and saved to dsfr_objects.json');


