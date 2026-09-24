'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Review table
    try {
      const reviewTable = await queryInterface.describeTable('review');
      if (!reviewTable.isFlagged) {
        await queryInterface.addColumn('review', 'isFlagged', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        });
      }
      if (!reviewTable.isHidden) {
        await queryInterface.addColumn('review', 'isHidden', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        });
      }
    } catch (e) {
      console.warn("Notice: Review table flags migration note:", e.message);
    }

    // Mentor commendation table
    try {
      const commTable = await queryInterface.describeTable('mentor_commendation');
      if (!commTable.isFlagged) {
        await queryInterface.addColumn('mentor_commendation', 'isFlagged', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        });
      }
      if (!commTable.isHidden) {
        await queryInterface.addColumn('mentor_commendation', 'isHidden', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        });
      }
    } catch (e) {
      console.warn("Notice: Mentor commendation flags migration note:", e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const reviewTable = await queryInterface.describeTable('review');
      if (reviewTable.isFlagged) await queryInterface.removeColumn('review', 'isFlagged');
      if (reviewTable.isHidden) await queryInterface.removeColumn('review', 'isHidden');
    } catch (e) {}

    try {
      const commTable = await queryInterface.describeTable('mentor_commendation');
      if (commTable.isFlagged) await queryInterface.removeColumn('mentor_commendation', 'isFlagged');
      if (commTable.isHidden) await queryInterface.removeColumn('mentor_commendation', 'isHidden');
    } catch (e) {}
  }
};
