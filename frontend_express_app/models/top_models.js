var mongoose = require('mongoose');

const Schema = mongoose.Schema;
const TopSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

module.exports = new mongoose.model("shirt", TopSchema);
