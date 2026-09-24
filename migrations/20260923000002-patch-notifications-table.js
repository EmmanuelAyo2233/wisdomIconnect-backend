'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('notifications', 'receiverType', {
        type: Sequelize.ENUM('mentor', 'mentee', 'admin'),
        allowNull: false,
      });
    } catch (e) {
      console.warn("Notice: could not change receiverType on notifications:", e.message);
    }

    try {
      await queryInterface.changeColumn('notifications', 'message', {
        type: Sequelize.TEXT,
        allowNull: false,
      });
    } catch (e) {
      console.warn("Notice: could not change message on notifications:", e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('notifications', 'message', {
        type: Sequelize.STRING,
        allowNull: false,
      });
    } catch (e) {
      console.warn("Notice: could not revert message on notifications:", e.message);
    }
  }
};
