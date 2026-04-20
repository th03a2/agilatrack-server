import mongoose from "mongoose";

const { Schema } = mongoose;

export const RACE_ENTRY_STATUSES = [
  "booked",
  "checked_in",
  "boarded",
  "departed",
  "arrived",
  "dnf",
  "no_show",
  "scratched",
  "disqualified",
];

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const getDistanceMeters = (from, to) => {
  if (
    from?.latitude === undefined ||
    from?.longitude === undefined ||
    to?.latitude === undefined ||
    to?.longitude === undefined
  ) {
    return null;
  }

  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const coordinateSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { _id: false },
);

const stationSchema = new Schema(
  {
    code: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    name: {
      type: String,
      trim: true,
    },
    coordinates: {
      type: coordinateSchema,
    },
    address: {
      street: { type: String, trim: true },
      barangay: { type: String, trim: true },
      municipality: { type: String, trim: true },
      province: { type: String, trim: true },
      region: { type: String, trim: true },
    },
  },
  { _id: false },
);

const transportSchema = new Schema(
  {
    handler: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    transporter: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    driver: {
      name: { type: String, trim: true },
      mobile: { type: String, trim: true },
      licenseNumber: { type: String, trim: true },
    },
    vehicle: {
      type: { type: String, trim: true },
      plateNumber: { type: String, trim: true, uppercase: true },
      description: { type: String, trim: true },
    },
    origin: {
      name: { type: String, trim: true },
      departedAt: { type: Date },
    },
    releaseSiteArrival: {
      arrivedAt: { type: Date },
      receivedBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      remarks: { type: String, trim: true },
    },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const liberationSchema = new Schema(
  {
    liberator: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    releasedByName: { type: String, trim: true },
    witnesses: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "Users",
        },
        name: { type: String, trim: true },
        role: { type: String, trim: true },
      },
    ],
    verifiedAt: { type: Date },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
      required: true,
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
      required: true,
    },
    loft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
      required: true,
    },
    loftSnapshot: {
      code: { type: String, trim: true, uppercase: true },
      name: { type: String, trim: true },
      coordinates: {
        type: coordinateSchema,
        required: true,
      },
    },
    bird: {
      bandNumber: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        maxlength: 40,
      },
      name: { type: String, trim: true },
      sex: {
        type: String,
        enum: ["cock", "hen", "unknown"],
        default: "unknown",
      },
      color: { type: String, trim: true },
      strain: { type: String, trim: true },
      hatchYear: {
        type: Number,
        min: 1900,
        max: 2200,
      },
    },
    booking: {
      channel: {
        type: String,
        enum: ["online", "manual"],
        default: "online",
      },
      bookedAt: {
        type: Date,
        default: Date.now,
      },
      bookingCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
      remarks: { type: String, trim: true },
    },
    checkIn: {
      station: {
        type: stationSchema,
      },
      status: {
        type: String,
        enum: ["pending", "checked_in", "rejected", "no_show"],
        default: "pending",
      },
      checkedInAt: { type: Date },
      checkedInBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      remarks: { type: String, trim: true },
    },
    boarding: {
      station: {
        type: stationSchema,
      },
      boardingPassNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
      crateNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
      compartmentNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
      sequenceNumber: {
        type: Number,
        min: 1,
      },
      sealNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },
    departure: {
      station: {
        type: stationSchema,
      },
      siteName: { type: String, trim: true },
      departedAt: { type: Date },
      coordinates: {
        type: coordinateSchema,
      },
    },
    transport: {
      type: transportSchema,
      default: () => ({}),
    },
    liberation: {
      type: liberationSchema,
      default: () => ({}),
    },
    arrival: {
      arrivedAt: { type: Date },
      clockedBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      source: {
        type: String,
        enum: ["manual", "electronic_clock", "mobile"],
        default: "manual",
      },
      remarks: { type: String, trim: true },
    },
    result: {
      rank: {
        type: Number,
        min: 1,
      },
      status: {
        type: String,
        enum: ["pending", "qualified", "dnf", "scratched", "disqualified"],
        default: "pending",
      },
      disqualifiedReason: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: RACE_ENTRY_STATUSES,
      default: "booked",
    },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

modelSchema.virtual("flightDurationMs").get(function getFlightDurationMs() {
  const departedAt = this.departure?.departedAt;
  const arrivedAt = this.arrival?.arrivedAt;

  if (!departedAt || !arrivedAt) return null;

  const duration = arrivedAt.getTime() - departedAt.getTime();
  return duration >= 0 ? duration : null;
});

modelSchema.virtual("flightDurationMinutes").get(function getDurationMinutes() {
  if (this.flightDurationMs === null) return null;
  return this.flightDurationMs / 1000 / 60;
});

modelSchema.virtual("distanceMeters").get(function getDistance() {
  return getDistanceMeters(
    this.departure?.coordinates,
    this.loftSnapshot?.coordinates,
  );
});

modelSchema.virtual("distanceKilometers").get(function getDistanceKilometers() {
  if (this.distanceMeters === null) return null;
  return this.distanceMeters / 1000;
});

modelSchema.virtual("speedMetersPerMinute").get(function getSpeedMpm() {
  if (!this.distanceMeters || !this.flightDurationMinutes) return null;
  return this.distanceMeters / this.flightDurationMinutes;
});

modelSchema.virtual("speedKilometersPerHour").get(function getSpeedKph() {
  if (!this.distanceKilometers || !this.flightDurationMs) return null;
  return this.distanceKilometers / (this.flightDurationMs / 1000 / 60 / 60);
});

modelSchema.virtual("arrivalPlace").get(function getArrivalPlace() {
  return this.result?.rank || null;
});

modelSchema.pre("validate", function validateRaceEntry(next) {
  if (!this.departure?.coordinates && this.departure?.station?.coordinates) {
    this.departure.coordinates = this.departure.station.coordinates;
  }

  if (
    this.checkIn?.status === "checked_in" &&
    !this.checkIn?.checkedInAt
  ) {
    this.checkIn.checkedInAt = new Date();
  }

  if (this.status === "boarded" && !this.boarding?.crateNumber) {
    return next(new Error("Crate number is required once bird is boarded."));
  }

  const bookedAt = this.booking?.bookedAt;
  const checkedInAt = this.checkIn?.checkedInAt;
  const departedAt = this.departure?.departedAt;
  const arrivedAt = this.arrival?.arrivedAt;

  if (bookedAt && checkedInAt && checkedInAt < bookedAt) {
    return next(new Error("Check-in time cannot be earlier than booking."));
  }

  if (checkedInAt && departedAt && departedAt < checkedInAt) {
    return next(new Error("Departure time cannot be earlier than check-in."));
  }

  if (departedAt && arrivedAt && arrivedAt < departedAt) {
    return next(new Error("Arrival time cannot be earlier than departure."));
  }

  if (arrivedAt && !departedAt) {
    return next(
      new Error("Departure time is required before recording arrival."),
    );
  }

  next();
});

modelSchema.statics.recalculateRanks = async function recalculateRanks(raceId) {
  const entries = await this.find({
    race: raceId,
    deletedAt: { $exists: false },
    "arrival.arrivedAt": { $exists: true },
    "result.status": { $nin: ["scratched", "disqualified", "dnf"] },
  });

  entries.sort((first, second) => {
    const firstSpeed = first.speedMetersPerMinute || 0;
    const secondSpeed = second.speedMetersPerMinute || 0;

    if (secondSpeed !== firstSpeed) return secondSpeed - firstSpeed;

    return (
      first.arrival.arrivedAt.getTime() - second.arrival.arrivedAt.getTime()
    );
  });

  await Promise.all(
    entries.map((entry, index) => {
      entry.result.rank = index + 1;
      entry.result.status = "qualified";
      entry.status = "arrived";
      return entry.save();
    }),
  );

  return entries;
};

modelSchema.index({ race: 1, "bird.bandNumber": 1 }, { unique: true });
modelSchema.index({ race: 1, status: 1, deletedAt: 1 });
modelSchema.index({ race: 1, "result.rank": 1 });
modelSchema.index({ affiliation: 1, createdAt: -1 });
modelSchema.index({ loft: 1, createdAt: -1 });

const Entity = mongoose.model("RaceEntries", modelSchema);

export default Entity;
