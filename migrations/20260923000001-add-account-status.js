'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user');
    if (!tableInfo.accountStatus) {
      await queryInterface.addColumn('user', 'accountStatus', {
        type: Sequelize.ENUM('active', 'suspended', 'banned'),
        defaultValue: 'active',
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user');
    if (tableInfo.accountStatus) {
      await queryInterface.removeColumn('user', 'accountStatus');
    }
  }
};
