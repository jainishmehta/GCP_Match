var mongoose = require('mongoose');

const Schema = mongoose.Schema;
const DressSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

const ShortSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

const ShirtSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

const PantSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

const SkirtSchema = new Schema({
    base_64 : String,
    labels: [{0: String, 1:String}]
});

module.exports = new mongoose.model("dress", DressSchema);
