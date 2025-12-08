FROM locustio/locust:2.17.0

USER root

WORKDIR /mnt/locust

COPY load_test.py /mnt/locust/

CMD ["locust", "-f", "/mnt/locust/load_test.py"]
