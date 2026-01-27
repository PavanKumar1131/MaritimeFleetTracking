router.get('/stats', (req, res) => {
    res.json({
        totalVessels: 12,
        activeRoutes: 8,
        weatherAlerts: 8,
        engineWarnings: 4
    });
});
