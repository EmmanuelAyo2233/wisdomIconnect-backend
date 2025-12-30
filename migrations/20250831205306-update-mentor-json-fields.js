module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('mentor', 'discipline', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('mentor', 'experience', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('mentor', 'discipline', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('mentor', 'experience');
  }
};
