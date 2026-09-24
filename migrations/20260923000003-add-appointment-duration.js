'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('appointment');
    if (!tableInfo.duration) {
      await queryInterface.addColumn('appointment', 'duration', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('appointment');
    if (tableInfo.duration) {
      await queryInterface.removeColumn('appointment', 'duration');
    }
  }
};
