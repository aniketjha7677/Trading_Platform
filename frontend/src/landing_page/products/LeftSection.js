import React from 'react';

function LeftSection({
    imageURL,
    productName,
    productDescription,
    tryDemo,
    learnMore,
    googlePlay,
    appStore
}) {
    return (
        <div className="container-fluid mt-5 px-5">
            <div
                className="row align-items-center"
                style={{ minHeight: "600px" }}
            >
                {/* Left Image */}
                <div className="col-6 md-6 text-center">
                    <img
                        src={imageURL}
                        alt={productName}
                        className="img-fluid"
                        style={{
                            width: "100%",
                            maxWidth: "850px",
                            height: "auto"
                        }}
                    />
                </div>

                {/* Right Content */}
                <div
                    className="col-6 md-6"
                    style={{
                        paddingLeft: "65px",
                        paddingRight: "80px"
                    }}
                >
                    <h1
                        style={{
                            fontSize: "30px",
                            fontWeight: "400",
                            color: "#424242",
                            marginBottom: "25px"
                        }}
                    >
                        {productName}
                    </h1>

                    <p
                        style={{
                            fontSize: "18px",
                            lineHeight: "1.5",
                            color: "#424242",
                            marginBottom: "28px"
                        }}
                    >
                        {productDescription}
                    </p>

                    {/* Links */}
                    <div
                        className="d-flex flex-wrap"
                        style={{ gap: "70px", marginBottom: "30px" }}
                    >
                        <a
                            href={tryDemo}
                            className="text-decoration-none"
                            style={{
                                fontSize: "17px",
                                color: "#387ed1"
                            }}
                        >
                            Try demo&nbsp; →
                        </a>

                        <a
                            href={learnMore}
                            className="text-decoration-none"
                            style={{
                                fontSize: "17px",
                                color: "#387ed1"
                            }}
                        >
                            Learn more&nbsp; →
                        </a>
                    </div>

                    {/* Store Badges */}
                    <div
                        className="d-flex flex-wrap align-items-center"
                        style={{ gap: "28px" }}
                    >
                        <a href={googlePlay}>
                            <img
                                src="media/images/googlePlayBadge.svg"
                                alt="Google Play"
                                style={{
                                    height: "50px",
                                    width: "90%"
                                }}
                            />
                        </a>

                        <a href={appStore}>
                            <img
                                src="media/images/appStoreBadge.svg"
                                alt="App Store"
                                style={{
                                    height: "50px",
                                    width: "90%"
                                }}
                            />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeftSection;