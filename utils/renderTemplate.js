const ejs = require("ejs");
const path = require("path");

const renderTemplate = async (templateName, data) => {
    const filePath = path.join(__dirname, `../templates/${templateName}.ejs`);
    return await ejs.renderFile(filePath, data);
};

module.exports = renderTemplate;
