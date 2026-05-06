import Joi from "joi";
import { BIRD_CATEGORIES, BIRD_SEXES, BIRD_SPECIES, BIRD_STATUSES } from "../models/Birds.js";
import { CLUB_LEVELS } from "../models/Clubs.js";
import { RACE_CATEGORIES, RACE_STATUSES } from "../models/Races.js";

const objectId = Joi.string().hex().length(24);
const optionalObjectId = objectId.allow("", null);
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } });

const coordinatesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
}).unknown(true);

const fullNameSchema = Joi.object({
  fname: Joi.string().trim().min(1).max(80).required(),
  lname: Joi.string().trim().min(1).max(80).required(),
  mname: Joi.string().trim().allow(""),
}).unknown(true);

export const authSchemas = {
  login: Joi.object({
    email: email.required(),
    password: Joi.string().required(),
  }).unknown(true),
  register: Joi.object({
    email: email.required(),
    fullName: fullNameSchema.required(),
    mobile: Joi.string().trim().min(7).max(24).required(),
    password: Joi.string().min(8).required(),
    username: Joi.string().trim().min(4).max(32).required(),
  }).unknown(true),
};

export const birdSchemas = {
  create: Joi.object({
    bandNumber: Joi.string().trim().min(1).max(40).required(),
    category: Joi.string().valid(...BIRD_CATEGORIES),
    club: objectId,
    clubId: objectId,
    hatchDate: Joi.date().allow("", null),
    hatchYear: Joi.number().integer().min(1900).max(2200),
    loft: optionalObjectId,
    name: Joi.string().trim().min(1).max(80).required(),
    owner: optionalObjectId,
    ownerId: optionalObjectId,
    sex: Joi.string().valid(...BIRD_SEXES),
    species: Joi.string().valid(...BIRD_SPECIES),
    status: Joi.string().valid(...BIRD_STATUSES),
  }).unknown(true),
  update: Joi.object({
    bandNumber: Joi.string().trim().min(1).max(40),
    category: Joi.string().valid(...BIRD_CATEGORIES),
    club: optionalObjectId,
    clubId: optionalObjectId,
    hatchDate: Joi.date().allow("", null),
    hatchYear: Joi.number().integer().min(1900).max(2200),
    loft: optionalObjectId,
    name: Joi.string().trim().min(1).max(80),
    owner: optionalObjectId,
    ownerId: optionalObjectId,
    sex: Joi.string().valid(...BIRD_SEXES),
    species: Joi.string().valid(...BIRD_SPECIES),
    status: Joi.string().valid(...BIRD_STATUSES),
  }).unknown(true),
};

export const clubSchemas = {
  create: Joi.object({
    code: Joi.string().trim().min(3).max(24).required(),
    level: Joi.string().valid(...CLUB_LEVELS).required(),
    location: Joi.object().unknown(true),
    name: Joi.string().trim().min(2).max(160).required(),
    parent: optionalObjectId,
  }).unknown(true),
  update: Joi.object({
    code: Joi.string().trim().min(3).max(24),
    level: Joi.string().valid(...CLUB_LEVELS),
    location: Joi.object().unknown(true),
    name: Joi.string().trim().min(2).max(160),
    parent: optionalObjectId,
  }).unknown(true),
};

export const affiliationSchemas = {
  create: Joi.object({
    application: Joi.object({
      address: Joi.string().trim().min(1).required(),
      email: email.required(),
      fullName: Joi.string().trim().min(1).required(),
      reasonForJoining: Joi.string().trim().min(1).required(),
    }).unknown(true),
    club: objectId.required(),
    membershipType: Joi.string().trim().max(80),
    mobile: Joi.string().trim().allow(""),
    user: objectId.required(),
  }).unknown(true),
};

export const raceSchemas = {
  create: Joi.object({
    category: Joi.string().valid(...RACE_CATEGORIES),
    club: objectId.required(),
    code: Joi.string().trim().min(3).max(32).required(),
    departure: Joi.object({
      coordinates: coordinatesSchema.required(),
      siteName: Joi.string().trim().min(1).required(),
    }).unknown(true).required(),
    name: Joi.string().trim().min(2).required(),
    raceDate: Joi.date().required(),
    status: Joi.string().valid(...RACE_STATUSES),
  }).unknown(true),
  update: Joi.object({
    category: Joi.string().valid(...RACE_CATEGORIES),
    club: optionalObjectId,
    code: Joi.string().trim().min(3).max(32),
    departure: Joi.object({
      coordinates: coordinatesSchema,
      siteName: Joi.string().trim().min(1),
    }).unknown(true),
    name: Joi.string().trim().min(2),
    raceDate: Joi.date(),
    status: Joi.string().valid(...RACE_STATUSES),
  }).unknown(true),
};

export const raceEntrySchemas = {
  book: Joi.object({
    affiliation: objectId.required(),
    bird: Joi.object({
      bandNumber: Joi.string().trim().min(1).max(40).required(),
      name: Joi.string().trim().allow(""),
    }).unknown(true).required(),
    loft: objectId.required(),
    race: objectId.required(),
  }).unknown(true),
};
