const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
});

const Room = sequelize.define('Room', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true
    },
    website_url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

const Sender = sequelize.define('Sender', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    client_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    total_sent: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

const ProcessLog = sequelize.define('ProcessLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
    total_sent_in_process: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

// Relationships
Room.hasMany(Sender, { foreignKey: 'room_id' });
Sender.belongsTo(Room, { foreignKey: 'room_id' });

Room.hasMany(ProcessLog, { foreignKey: 'room_id' });
ProcessLog.belongsTo(Room, { foreignKey: 'room_id' });

module.exports = {
    sequelize,
    Room,
    Sender,
    ProcessLog
};
