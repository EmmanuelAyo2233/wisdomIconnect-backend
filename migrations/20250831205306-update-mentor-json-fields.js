module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('mentor');
    if (!columns.discipline) throw new Error('Missing mentor.discipline; review legacy schema before migrating');
    if (!String(columns.discipline.type).toUpperCase().includes('JSON')) {
      const [[result]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS invalidCount FROM `mentor` WHERE `discipline` IS NOT NULL AND JSON_VALID(`discipline`) = 0');
      if (Number(result.invalidCount)) throw new Error('Reconcile non-JSON mentor.discipline values before migrating');
      await queryInterface.changeColumn('mentor', 'discipline', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!columns.experience) {
      await queryInterface.addColumn('mentor', 'experience', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('mentor', 'discipline', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('mentor', 'experience');
  }
};
